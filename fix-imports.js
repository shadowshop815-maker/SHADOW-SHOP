const fs = require('fs');
const path = require('path');

function replaceInDir(dir, search, replacement) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath, search, replacement);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (typeof search === 'string') {
        content = content.split(search).join(replacement);
      } else {
        content = content.replace(search, replacement);
      }
      fs.writeFileSync(fullPath, content);
    }
  }
}

// Fix admin app
const adminPages = path.join(__dirname, 'apps/admin/src/pages');
fs.readdirSync(adminPages).forEach(item => {
  const fullPath = path.join(adminPages, item);
  if (fs.statSync(fullPath).isDirectory()) {
    replaceInDir(fullPath, /"\.\.\/\.\.\/\.\.\/api"/g, '"../../api"');
  } else if (item.endsWith('.tsx')) {
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/"\.\.\/\.\.\/api"/g, '"../api"');
    fs.writeFileSync(fullPath, content);
  }
});

// Fix customer app
const custPages = path.join(__dirname, 'apps/customer/src/pages');
fs.readdirSync(custPages).forEach(item => {
  const fullPath = path.join(custPages, item);
  if (fs.statSync(fullPath).isDirectory()) {
    replaceInDir(fullPath, /"\.\.\/\.\.\/\.\.\/api"/g, '"../../api"');
    replaceInDir(fullPath, /"\.\.\/\.\.\/\.\.\/types"/g, '"../../types"');
    replaceInDir(fullPath, /"\.\.\/\.\.\/\.\.\/features\//g, '"../../features/');
  } else if (item.endsWith('.tsx')) {
    let content = fs.readFileSync(fullPath, 'utf8');
    content = content.replace(/"\.\.\/\.\.\/api"/g, '"../api"');
    content = content.replace(/"\.\.\/\.\.\/types"/g, '"../types"');
    content = content.replace(/"\.\.\/\.\.\/features\//g, '"../features/');
    fs.writeFileSync(fullPath, content);
  }
});

const custComponents = path.join(__dirname, 'apps/customer/src/components');
replaceInDir(custComponents, /"\.\.\/\.\.\/api"/g, '"../api"');
replaceInDir(custComponents, /"\.\.\/\.\.\/types"/g, '"../types"');

const custApp = path.join(__dirname, 'apps/customer/src/App.tsx');
let appContent = fs.readFileSync(custApp, 'utf8');
appContent = appContent.replace(/'\.\/SearchPage'/g, "'./pages/SearchPage'");
fs.writeFileSync(custApp, appContent);

console.log('Imports fixed!');
