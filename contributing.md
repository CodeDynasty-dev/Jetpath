
# JetPath  Contributing Guide

## Welcome

Welcome to the JetPath Contributing Guide, and thank you for your interest.

If you would like to contribute to a specific part of the project, check out the following list of contributions that we accept and their corresponding sections that are within this guide:

* Documentation 
  * Go to the `docs` dir
* Bug Fixes
  * Go to source code dir at `src`
* New Features
  * Create a sample of the new feature, and start a discussion  in the community forum.

However, at this time, we do not accept the following contributions:

* Maintenance 

## JetPath overview

The purpose of the JetPath is to streamline your development process while offering flexibility in your choice of runtime environment

## Ground rules

Before contributing, read our {link to the Code of Conduct} to learn more about our community guidelines and expectations.

## Community engagement

Refer to the following channels to connect with fellow contributors or to stay up-to-date with news about JetPath:

* Join our project contributors on {name and link to online chat}.Discord 
* Participate in our project meetings on {specify the day of the week and cadence} at {specify time and timezone}, where you can provide a status update or raise questions and concerns about your contributions. Use the following link to join: {link to online meeting space}
2-3 meetings monthly, Fridays

## Before you start

Before you start contributing, ensure you have the following:
* For developers: The latest version of Node.js, Bon.js, Deno.js. 
* For writers: The lastest version of Node.js.




## Environment setup

To set up your environment, perform the following actions:

### Developer

1. Fork the Repository
Click the Fork button at the top right of the repository page to create a copy under your GitHub account. This allows you to freely make changes without affecting the original project.

2. Clone Your Fork Locally
Clone your forked repository to your computer using the command below. Replace <yourusername> with your GitHub username:

```bash
git clone https://github.com/<yourusername>/JetPath.git
```
3. Navigate to the Project Directory
Change into the project folder:

```bash
cd JetPath
```
4. Install Dependencies
Install all necessary packages with npm:

```bash
npm install

```
This will download and set up all libraries the project depends on.

5. Run the Development Server
Start the local server to preview your changes in real-time:

```bash
npm run dev
```
Open your browser and go to the URL shown in the terminal (usually http://localhost:4000).

6. Compile the Project
When you’re ready to build the project for production, run:

```bash
npm run compile
```
This compiles and optimizes the code for deployment.

> Additional Tips

* Create a new branch for your changes before you start working:

```bash
git checkout -b your-feature-branch
```
* Commit often with clear, descriptive messages.

* Push your branch to your fork and open a Pull Request to the main repository.

Feel free to ask questions or open an issue if you need help!


### Writers


1. Fork the Repository
Click the Fork button at the top right of the repository page to create a copy under your GitHub account. This allows you to freely make changes without affecting the original project.

2. Clone Your Fork Locally
Clone your forked repository to your computer using the command below. Replace <yourusername> with your GitHub username:

```bash
git clone https://github.com/<yourusername>/JetPath.git
```
3. Navigate to the Project Directory
Change into the project folder:

```bash
cd JetPath
```
4. Install Dependencies
Install all necessary packages with npm:

```bash
npm install

```
This will download and set up all libraries the project depends on.

5. Preview your changes with this command below

```bash
npx docmach 
```

Open your browser and go to the URL shown in the terminal (usually http://localhost:4000).

> Additional Tips

* Create a new branch for your changes before you start working:

```bash
git checkout -b your-feature-branch
```
* Commit often with clear, descriptive messages.

* Push your branch to your fork and open a Pull Request to the main repository.

Feel free to ask questions or open an issue if you need help!

### Troubleshoot

If you encounter issues as you set up your environment,
reach out to the team @fridaycandour @NickyShe



## Best practices

Our project has adopted the following best practices for contributing:

### Developers

* Organize your code properly
* run your test


Our project uses the [Google Typescript coding style guide](https://github.com/google/gts) as our parent guide for best practices. Reference the guide to familiarize yourself with the best practices we want contributors to follow.

### Writers

Read the [Google developers documentation writing style guide](https://developers.google.com/style) to understand our guidelines for writing and formatting documents. The purpose of the style guide is to ensure consistency in the tone, voice, and structure of our documentation.

## Contribution workflow

### Report issues and bugs

{Provide instructions on how to report problems.}

### Issue management

{Provide instructions on how to create, tag, and assign issues.}

### Commit messages

{Provide instructions on how to format commit messages.}

### Branch creation

{Provide instructions on how to create and/or name a branch.}

### Pull requests

{Provide instructions on how to submit a pull request. Share a link to an example pull request or include the pull request template you want contributors to use within this section.}

### Releases

{Provide a description of the release process and cadence for the project, such as the source code.}

### Text formats

{Provide information on what you need contributors to know and use to edit and create documents.}

---
 