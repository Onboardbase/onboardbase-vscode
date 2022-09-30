# Onboardbase VSCode Extension

Onboardbase is an all-in-one SecretOps infrastructure for securing environment configs/secret credentials across all stages from development to production.

Our vscode extension provides easy access to secrets from local development to production in every development stage by retrieving, adding and uploading secrets without leaving the comfort of your text editor.

## Features

The extension enables uploading secrets to onboardbase, converting a text to a secret in your local config, setting up a project and a codelens over env files propmting addition of the secret to onboardbase.

To use the extension after installtion, open the command pallete `cmd + shift + P` and type in one of the below commands:

- Login: `Onboardbase: Login To Onboardbase`
- Setup: `Onboardbase: Setup Project`
- Logout: `Onboardbase: Logout`
- Upload Secret: `Onboardbase: Upload Secret To Onboardbase`
- Add Secret to Local Config: `Onboardbase: Add Secret To Local Config`
- Search/Retrive Secret: `Onboardbase: Retrieve Secret From Onboardbase`

## Requirements

- vscode version 1.7.0 and above
- Node and NPM installed

## Extension Settings

To enable codelens for `.env` files, the setting needs to be activated.

This extension contributes the following settings:

* `onboardbase-codelens.enableCodelens`: Enables/disables `.env` codelens.

## Release Notes

### 1.0.0

Initial release of the extension
