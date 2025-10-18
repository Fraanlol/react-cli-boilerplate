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

function validateTemplate(template) {
  if (!template || typeof template !== "string") {
    return "base";
  }

  const name = template.trim().toLowerCase();

  // Basic validation for template name
  if (!/^[a-z0-9-]+$/.test(name)) {
    return "base";
  }

  // Check if template is in the available list
  if (!AVAILABLE_TEMPLATES.includes(name)) {
    return "base";
  }

  return name;
}

async function createProject(projectName, options) {
  let { template } = options;

  try {
    const answers = await inquirer.prompt([
      {
        type: "input",
        name: "projectName",
        message: "Project name:",
        when: () => !projectName,
        validate: (input) => {
          if (!input || !input.trim()) {
            return "Project name is required";
          }

          const name = input.trim();

          // Validate project name format
          if (!/^[a-zA-Z0-9-_]+$/.test(name)) {
            return "Project name can only contain letters, numbers, hyphens, and underscores";
          }

          if (name.length > 50) {
            return "Project name must be 50 characters or less";
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
    ]);

    projectName = projectName || answers.projectName;
    template = template || answers.template;

    // Validate template
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
        `\n🚀 Creating ${chalk.bold(projectName)} with template: ${chalk.yellow(
          template
        )}\n`
      )
    );

    const projectPath = path.resolve(process.cwd(), projectName);

    // Check if directory already exists
    if (fs.existsSync(projectPath)) {
      console.log(
        chalk.red(
          `\nError: Directory '${projectName}' already exists. Please choose a different project name.\n`
        )
      );
      process.exit(1);
    }

    // Check if parent directory is writable
    const parentDir = path.dirname(projectPath);
    try {
      await fs.access(parentDir, fs.constants.W_OK);
    } catch (err) {
      console.log(
        chalk.red(
          `\nError: Cannot write to directory '${parentDir}'. Please check permissions.\n`
        )
      );
      process.exit(1);
    }

    const spinner = ora("Downloading template...").start();

    try {
      const emitter = degit(`fraanlol/template-react-${template}`, {
        cache: false,
        force: true,
        verbose: false,
      });

      await emitter.clone(projectPath);
      spinner.succeed("Template downloaded successfully!");

      // Show success message and next steps
      console.log(
        chalk.green(
          `\n✅ Project ${chalk.bold(projectName)} created successfully!\n`
        )
      );

      console.log(chalk.cyan("Next steps:"));
      console.log(chalk.white(`  cd ${projectName}`));
      console.log(chalk.white("  npm install"));
      console.log(chalk.white("  npm run dev\n"));
    } catch (err) {
      spinner.fail("Failed to download template.");

      // Clean up partially created directory if it exists
      if (fs.existsSync(projectPath)) {
        try {
          await fs.remove(projectPath);
          console.log(
            chalk.yellow("Cleaned up partially created project directory.")
          );
        } catch (cleanupErr) {
          console.log(
            chalk.yellow(
              `Warning: Could not clean up directory '${projectName}'. You may need to remove it manually.`
            )
          );
        }
      }

      console.error(chalk.red("\nError details:"), err.message);

      if (err.code === "COULD_NOT_DOWNLOAD") {
        console.log(
          chalk.yellow(
            "\nCould not download template. Please check your internet connection and try again."
          )
        );
      }

      process.exit(1);
    }
  } catch (error) {
    if (error.isTtyError) {
      console.log(
        chalk.red("Prompt couldn't be rendered in the current environment")
      );
    } else {
      console.log(chalk.red("Something went wrong:"), error.message);
    }
    process.exit(1);
  }
}

program
  .name("create-modern-react-app")
  .description(
    "Create a modern React application with TypeScript, Vite, and TailwindCSS"
  )
  .version(packageJson.version)
  .argument(
    "[project-name]",
    "name of the project to create (optional in interactive mode)"
  )
  .option("-t, --template <template>", "template to use")
  .action(createProject);

// Parse arguments
program.parse();
