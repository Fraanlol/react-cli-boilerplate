#!/usr/bin/env node

import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs-extra";
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import degit from "degit";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = fs.readJsonSync(path.join(__dirname, "package.json"));

const program = new Command();

const AVAILABLE_TEMPLATES = ["base", "redux"];

function validateTemplate(t) {
  if (!t || typeof t !== "string") return "base";

  const name = t.trim().toLowerCase();

  if (!/^[a-z0-9-]+$/.test(name)) return "base";

  // Prevent path traversal
  try {
    const templatesRoot = path.resolve(__dirname, ".."); // packages/
    const resolved = path.resolve(templatesRoot, `template-${name}`);
    const realTemplatesRoot = fs.realpathSync(templatesRoot);
    const realResolved = fs.realpathSync(resolved);
    const relative = path.relative(realTemplatesRoot, realResolved);
    if (
      relative.startsWith("..") ||
      (path.isAbsolute(relative) && !realResolved.startsWith(realTemplatesRoot))
    ) {
      return "base";
    }

    if (!fs.existsSync(realResolved)) {
      return "base";
    }

    const stat = fs.statSync(realResolved);
    if (!stat.isDirectory()) return "base";

    // If template contains a package.json, warn if it defines install/lifecycle scripts
    const tplPkgPath = path.join(realResolved, "package.json");
    if (fs.existsSync(tplPkgPath)) {
      try {
        const tplPkg = fs.readJsonSync(tplPkgPath);
        if (tplPkg && tplPkg.scripts) {
          const lifecycleKeys = [
            "preinstall",
            "install",
            "postinstall",
            "prepublish",
            "prepare",
          ];
          const found = lifecycleKeys.filter((k) =>
            Object.prototype.hasOwnProperty.call(tplPkg.scripts, k)
          );
          if (found.length) {
            console.log(
              chalk.yellow(
                `\n⚠️  Template 'template-${name}' declares lifecycle scripts (${found.join(
                  ", "
                )}). These will run during installation. Proceed with caution.\n`
              )
            );
          }
        }
      } catch (err) {
        return "base";
      }
    }
  } catch (err) {
    return "base";
  }

  return name;
}

async function createProject(projectName, options) {
  let { template } = options;

  inquirer
    .prompt([
      {
        type: "input",
        name: "projectName",
        message: "Project name:",
        when: () => !projectName,
        validate: (input) => {
          if (!input || !input.trim()) {
            return "Project name is required";
          }
          return true;
        },
      },
      {
        type: "list",
        name: "template",
        message: "Select a template:",
        choices: AVAILABLE_TEMPLATES,
        default: "base",
        when: () => !template || !AVAILABLE_TEMPLATES.includes(template),
      },
    ])
    .then(async (answers) => {
      console.log(answers);
      projectName = projectName || answers.projectName;

      const finalTemplate = validateTemplate(template);
      if (finalTemplate !== template) {
        console.log(
          chalk.yellow(
            `\n⚠️  Template '${template}' is not valid. Falling back to 'base'. Available templates: ${AVAILABLE_TEMPLATES.join(
              ", "
            )}\n`
          )
        );
      }
      template = finalTemplate;

      console.log(
        chalk.cyan(
          `\n🚀 Creating ${chalk.bold(
            projectName
          )} with template: ${chalk.yellow(template)}\n`
        )
      );

      const projectPath = path.resolve(process.cwd(), projectName);

      if (fs.existsSync(projectPath)) {
        console.log(
          chalk.red(
            `\nError: Directory '${projectName}' already exists. Please choose a different project name.\n`
          )
        );
        process.exit(1);
      }
      const templatePath = path.resolve(
        __dirname,
        "..",
        `template-${template}`
      );

      if (!fs.existsSync(templatePath)) {
        console.log(
          chalk.red(`\nError: Template '${template}' does not exist.\n`)
        );
        process.exit(1);
      }

      console.log(projectPath, templatePath);
      const spinner = ora("Downloading template...").start();

      try {
        const emitter = degit("fraanlol/template-base", {
          cache: false,
          force: true,
          verbose: false,
        });
        await emitter.clone(projectPath);
        spinner.succeed("Template downloaded!");
      } catch (err) {
        spinner.fail("Failed to download template.");
        console.error(err);
        process.exit(1);
      }
    })
    .catch((error) => {
      if (error.isTtyError) {
        console.log(
          chalk.red("Prompt couldn't be rendered in the current environment")
        );
      } else {
        console.log(chalk.red("Something went wrong"), error);
      }
    });
}

program
  .name("create-modern-react-app")
  .description(
    "Create a modern React application with TypeScript, Vite, and TailwindCSS"
  )
  .version(packageJson.version)
  // Make project name optional to support interactive mode
  .argument(
    "[project-name]",
    "name of the project to create (optional in interactive mode)"
  )
  .option("-t, --template <template>", "template to use")
  .action(createProject);

// Parse arguments
program.parse();
