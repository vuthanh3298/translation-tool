const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const generate = require('@babel/generator').default;
const t = require('@babel/types');
const prettier = require('prettier');

const newTranslations = {}; // Object lưu trữ các new translate text

function isFunctionComponent(node) {
  return (
    node.type === 'FunctionDeclaration' &&
    node.body?.type === 'BlockStatement'
  );
}

// Tạo hàm tương ứng với t('text')
function createTranslationFunction(value, type = 'text') {
  if (type === 'text') {
    const trimValue = (value || '').replace(/[\n\s]+/g, ' ').trim();
    if (trimValue) {
      newTranslations[trimValue] = trimValue;
    }
    return t.jsxExpressionContainer(t.callExpression(t.identifier('t'), [t.stringLiteral(trimValue)]));
  } else if (type === 'var') {
    return t.jsxExpressionContainer(
      t.callExpression(
        t.identifier('t'),
        [t.identifier(value)]
      )
    );
  }
}

// Function to process individual component function
function processComponents(fileContent, filePath) {
  let content = fileContent;
  let ast = parser.parse(content, {
    sourceType: 'module',
    plugins: ['jsx'],
  });

  let isUseTranslationImported = false;
  let exportDefaultFunctionName = null;
  let exportUniqueFunctionName = null;

  // Duyệt qua các nodes để tìm import { useTranslation } từ 'react-i18next'
  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === 'react-i18next') {
        const specifiers = path.node.specifiers;
        specifiers.forEach(specifier => {
          if (specifier.imported && specifier.imported.name === 'useTranslation') {
            isUseTranslationImported = true;
          }
        });
      }
    },
    ExportDefaultDeclaration(path) {
      const declaration = path.node.declaration;
      if (declaration && isFunctionComponent(declaration)) {
        exportDefaultFunctionName = declaration.id.name;
      }
    },
    ExportNamedDeclaration(path) {
      const declaration = path.node.declaration;
      if (declaration && isFunctionComponent(declaration)) {
        exportUniqueFunctionName = declaration.id.name;
      }
    },
  });

  console.log({ isUseTranslationImported });

  if (!isUseTranslationImported) {
    const newImportStatement = `import { useTranslation } from "react-i18next";\n`;
    content = newImportStatement + content;
  }

  const mainComponentName = exportDefaultFunctionName || exportUniqueFunctionName;
  console.log({ mainComponentName });

  // Duyệt qua các nodes để tìm biến 't' được khai báo trong function component
  let isTDeclared = false;

  ast = parser.parse(content, {
    sourceType: 'module',
    plugins: ['jsx'],
  });
  traverse(ast, {
    FunctionDeclaration(path) {
      if (path.node.id.name === mainComponentName) {
        path.traverse({
          VariableDeclarator(innerPath) {
            if (
              innerPath.node.id.type === 'ObjectPattern' &&
              innerPath.node.id.properties.some(property => property.key.name === 't')
            ) {
              isTDeclared = true;
            }
          },
          JSXElement(jsxPath) {
            // Tìm các JSXText nodes
            if (jsxPath.node.openingElement.name.name === 'TestTag') {
              jsxPath.traverse({
                JSXAttribute(attrPath) {
                  if (attrPath.node.name.name === 'value') {
                    const attrValue = attrPath.node.value;
                    if (attrValue) {
                      if (attrValue.type === 'StringLiteral') {
                        const textValue = attrValue.value;
                        attrPath.node.value = createTranslationFunction(textValue);
                      } else if (attrValue.type === 'JSXExpressionContainer') {
                        if (attrValue.expression.type === 'StringLiteral') {
                          const textValue = attrValue.expression.value;
                          attrPath.node.value = createTranslationFunction(textValue);
                        } else if (attrValue.expression.type === 'Identifier') {
                          const identifierName = attrValue.expression.name;
                          attrPath.node.value = createTranslationFunction(identifierName, 'var');
                        }
                      }
                    }
                  }
                },
              });
            }
            jsxPath.traverse({
              JSXText(innerPath) {
                // Thay đổi JSXText thành t('text')
                const text = innerPath.node.value.trim();
                if (text !== '') {
                  innerPath.replaceWith(createTranslationFunction(innerPath.node.value));
                }
              },
              JSXExpressionContainer(innerPath) {
                if (innerPath.node.expression.type === 'Identifier') {
                  // Thay đổi JSXExpressionContainer thành t(name)
                  innerPath.replaceWith(createTranslationFunction(innerPath.node.expression.name, 'var'));
                } else if (innerPath.node.expression.type === 'StringLiteral') {
                  innerPath.replaceWith(createTranslationFunction(innerPath.node.expression.value));
                }
              },
            });
          },
        });
      }
    },
  });

  content = generate(ast).code;

  console.log({ isTDeclared });

  // Thêm biến 't' vào function component
  if (!isTDeclared) {
    ast = parser.parse(content, {
      sourceType: 'module',
      plugins: ['jsx'],
    });
    traverse(ast, {
      FunctionDeclaration(path) {
        if (path.node.id.name === mainComponentName) {
          const functionBody = path.get('body');
          const newLineNode = t.expressionStatement(t.identifier('\n\tconst { t } = useTranslation()'));
          functionBody.unshiftContainer('body', newLineNode);
        }
      },
    });

    content = generate(ast).code;
  }

  writeFile(content, filePath);
}

async function updateJsonFile() {
  if (Object.keys(newTranslations).length === 0) {
    return;
  }

  const jsonFilePath = './output/lang.json';
  let existingTranslations = {};
  if (fs.existsSync(jsonFilePath)) {
    const jsonContent = fs.readFileSync(jsonFilePath, 'utf8');
    existingTranslations = JSON.parse(jsonContent);
  }
  
  const combinedTranslations = { ...existingTranslations, ...newTranslations };
  console.log({ existingTranslations, newTranslations });
  fs.writeFileSync(jsonFilePath, JSON.stringify(combinedTranslations, null, 2), 'utf8');
}

async function writeFile(content, filePath) {
  const formattedCode = await prettier.format(content, { parser: 'babel' });
  fs.writeFileSync(filePath, formattedCode, 'utf8');
}

// Function to process directory and its files
function processDirectory(directoryPath) {
  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      console.error(`Error reading directory: ${err}`);
      return;
    }

    files.forEach((file) => {
      const filePath = path.join(directoryPath, file);
      if (fs.lstatSync(filePath).isDirectory()) {
        processDirectory(filePath);
      } else if (file.endsWith('.jsx')) {
        fs.readFile(filePath, 'utf8', (err, data) => {
          if (err) {
            console.error(`Error reading file ${filePath}: ${err}`);
            return;
          }
          processComponents(data, filePath);
        });
      }
    });
  });
}

function loadConfig() {

}

function main() {
  loadConfig();
  const directoryPath = './project';
  processDirectory(directoryPath);
  updateJsonFile();
}

main();