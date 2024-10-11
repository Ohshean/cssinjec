const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const puppeteer = require('puppeteer');
const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');
const path = require('path');
const { adminCredentials } = require('./models/account.js');
const { FLAG } = require('./models/flag.js');
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.set('view engine', 'ejs');
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 1200000 }
}));

const { username: id, password: pw } = adminCredentials;

async function readUrl(url) {
  try {
    const browser = await puppeteer.launch({ headless: true, executablePath: path.join(__dirname, 'chromedriver', 'chromium'), args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.goto('http://localhost:1105/login', { waitUntil: 'load' });
    await page.type('input[name="username"]', id);
    await page.type('input[name="password"]', pw);
    await page.click('button[type="submit"]', {waitUntil: 'load'});
    await page.waitForTimeout(1500);
    await page.goto(url, { waitUntil: ['load', 'networkidle2'] });
    await page.waitForTimeout(1500);
    await browser.close();
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

function checkCSSInjection(param) {
  const window = new JSDOM('').window;
  const DOMPurify = createDOMPurify(window);
  const sanitizedParam = DOMPurify.sanitize(param, {
    FORBID_TAGS: ['svg', 'math', 'mtext', 'mglyph', 'table', 'img', 'style', 'script', 'iframe', 'link', 'meta', 'object', 'embed'],  
    FORBID_ATTR: ['onload', 'formaction', 'src', 'data', 'onerror', 'onclick', 'onmouseover', 'onfocus'],
    KEEP_CONTENT: false,
    SANITIZE_DOM: true
  });
  const dangerousPattern = /<|>|&lt;|&gt;|CDATA|<!--|-->|]]>/gi;
  if (sanitizedParam !== param || dangerousPattern.test(sanitizedParam)) {
    return false;
  }
  const url = `http://localhost:1105/flag?param=${encodeURIComponent(sanitizedParam)}`;
  return readUrl(url);
}

app.get('/', (req, res) => {
  res.render('index');
});

app.route('/login')
  .get((req, res) => res.render('login'))
  .post((req, res) => {
    const { username, password } = req.body;
    if (username === id && password === pw) {
      req.session.isLoggedIn = true;
      res.redirect('/flag');
    } else {
      res.render('error', { message: 'Invalid credentials' });
    }
  });

app.get('/flag', (req, res) => {
  if (req.session.isLoggedIn) {
    const param = req.query.param || "";
    res.render('flag', { FLAG, param });
  } else {
    res.redirect('/login');
  }
});

let memoText = "";
app.route('/vuln')
  .get((req, res) => {
    const text = req.query.param || "";
    if (text) memoText += `Exfiltrated data: ${text}\n`;
    res.render('vuln', { memoText });
  })
  .post(async (req, res) => {
    const param = req.body.param;
    const isValid = await checkCSSInjection(param);
    if (!isValid) {
      res.send('<script>alert("wrong")</script>');
    } else {
      res.redirect('/vuln');
    }
  });

app.listen(1105, () => console.log('Server running on http://localhost:1105'));
