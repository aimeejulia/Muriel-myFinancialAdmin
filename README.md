# Muriel - myFinancialAdmin

Muriel is a desktop app for the financial admin of a freelancer or a small business. It runs on Linux.

Muriel keeps all data on your computer. It does not send your data to a server. The app is named after Muriel Siebert.

## What Muriel does

- **Clients**: keep the contact details, the VAT rate, the currency and the payment method of each client.
- **Invoices**: make invoices, show a preview, and save them as PDF files. You can write an invoice in the currency of the client.
- **Exchange rates**: Muriel gets the euro exchange rates of the European Central Bank (ECB) for the invoice date.
- **Payments**: mark an invoice paid, and enter the amount that arrived in your bank account.
- **Reminders**: click **More** > **Reminder** on an invoice to copy a payment reminder to the clipboard.
- **Expenses**: record expenses, attach the PDF receipt, and record expenses in other currencies.
- **Reports and dashboard**: see the invoiced amounts, VAT, income, expenses and estimated net income for a quarter or a year.
- **Import**: read invoices and expense receipts from PDF files.
- **Export**: save invoices, expenses and reports as CSV files.
- **Backups**: export all data to a backup file, and restore it later.
- **Updates**: the app tells you when a new version is available.

## Get started

### Install Muriel

The AppImage is the fastest way to install Muriel.

1. Open the [latest release](https://github.com/aimeejulia/Muriel-myFinancialAdmin/releases/latest) page.
2. Download the file that ends with `.AppImage`, for example `Muriel-myFinancialAdmin-1.3.0.AppImage`.
3. Open a terminal in the folder that contains the file.
4. Make the file executable:

   ```bash
   chmod +x Muriel-myFinancialAdmin-*.AppImage
   ```

5. Start Muriel:

   ```bash
   ./Muriel-myFinancialAdmin-*.AppImage
   ```

You can also start the AppImage from the file manager. Right-click the file, open **Properties**, and turn on **Allow executing file as program**. Then double-click the file.

If the AppImage does not start, install the FUSE library. Then start the AppImage again.

- On Ubuntu 24.04, Debian 13, and newer versions:

  ```bash
  sudo apt install libfuse2t64
  ```

- On older versions of Ubuntu and Debian:

  ```bash
  sudo apt install libfuse2
  ```

To install Muriel as a Snap or a Flatpak, or to run it from the source code, read [Other ways to install](#other-ways-to-install).

### First steps in the app

Do these steps one time, before you make your first invoice:

1. Click **Profile**.
2. Enter your name, legal name, email address, VAT number and address.
3. Select your **Book currency**. This is the currency of your accounts and your tax reports, for example EUR.
4. Click **Save profile**.
5. In **Profile**, click **Add payment method** to add your bank account or other payment details. Invoices show these details.
6. If you invoice under a trading name, click **Add trading name** in **Profile**. You can add a logo to each trading name.

Then do your daily work:

1. To add a client, click **Clients**, fill in the form, and click **Save client**.
2. To make an invoice, click **Invoices**, then **New invoice**. Select the client, fill in the form, and click **Create invoice**.
3. To make a PDF of an invoice, click **Preview** on the invoice. Then click **Download PDF**.
4. When the client pays, click **Mark paid** on the invoice. Enter the payment date and the amount that arrived in your bank account.
5. To record an expense, click **Expenses**, fill in the form, and click **Save expense**. To attach the PDF receipt, click **Upload expense PDF** first.
6. To see your totals, click **Dashboard** or **Reports**.

## Other ways to install

### Snap

1. Download the file that ends with `.snap` from the [latest release](https://github.com/aimeejulia/Muriel-myFinancialAdmin/releases/latest).
2. Install the Snap from the folder that contains the file:

   ```bash
   sudo snap install --dangerous ./muriel-myfinancialadmin_*_amd64.snap
   ```

3. Start Muriel from the app menu, or run `snap run muriel-myfinancialadmin`.

The `--dangerous` option is necessary because the Snap does not come from the Snap Store.

### Flatpak

1. Add the Flathub remote one time. The Flatpak needs the Freedesktop runtime from Flathub:

   ```bash
   flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
   ```

2. Download the file that ends with `.flatpak` from the [latest release](https://github.com/aimeejulia/Muriel-myFinancialAdmin/releases/latest).
3. Install the Flatpak from the folder that contains the file:

   ```bash
   flatpak install --user ./Muriel-myFinancialAdmin-*-x86_64.flatpak
   ```

4. Start Muriel from the app menu, or run `flatpak run com.muriel.myfinancialadmin`.

### From the source code

You need Node.js 22.12.0 or newer, npm 10 or newer, and git. The files `.nvmrc` and `.node-version` give the Node.js version.

1. If you do not have Node.js 22.12.0, install it with [nvm](https://github.com/nvm-sh/nvm):

   ```bash
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
   ```

2. Close the terminal and open a new one.
3. Install and select Node.js:

   ```bash
   nvm install 22.12.0
   nvm use 22.12.0
   ```

4. Get the source code:

   ```bash
   git clone https://github.com/aimeejulia/Muriel-myFinancialAdmin.git
   cd Muriel-myFinancialAdmin
   ```

5. Install the dependencies:

   ```bash
   npm install
   ```

6. Start Muriel:

   ```bash
   npm start
   ```

If the Node.js or npm version is too old, `npm install` stops with an error.

## Add the AppImage to the app menu

The Snap and the Flatpak add Muriel to the app menu when you install them. For the AppImage, use one of these two methods. Do not use both, because then the menu shows Muriel two times.

### Method A: a menu entry

1. Move the AppImage to the folder where you want to keep it, for example `~/Applications`.
2. Open a terminal in that folder.
3. Run these commands:

   ```bash
   APPIMAGE="$(ls "$PWD"/Muriel-myFinancialAdmin-*.AppImage)"
   chmod +x "$APPIMAGE"
   mkdir -p ~/.local/share/applications
   cat > ~/.local/share/applications/muriel-myfinancialadmin.desktop <<EOF
   [Desktop Entry]
   Name=Muriel - myFinancialAdmin
   Comment=Local-first financial admin desktop app
   Exec=${APPIMAGE}
   Type=Application
   Categories=Office;Finance;
   StartupWMClass=Muriel - myFinancialAdmin
   EOF
   update-desktop-database ~/.local/share/applications || true
   ```

If you move or rename the AppImage later, do these steps again.

### Method B: AppImageLauncher

1. Install AppImageLauncher:

   ```bash
   sudo apt install appimagelauncher
   ```

2. Double-click the AppImage.
3. Select **Integrate and run**.

### Remove duplicate menu entries

If the menu shows Muriel two times, remove the entries that AppImageLauncher made:

```bash
rm -f ~/.local/share/applications/appimagekit_*-Muriel_-_myFinancialAdmin.desktop
find ~/.local/share/icons/hicolor -type f -name "appimagekit_*_muriel-myfinancialadmin.png" -delete
update-desktop-database ~/.local/share/applications || true
```

If the menu still shows two entries, log out and log in again.

### Pin Muriel to the GNOME dock

1. Open **Activities**.
2. Search for "Muriel - myFinancialAdmin" and start it.
3. Right-click the Muriel icon in the dock.
4. Select **Pin to Dash**.

## Update Muriel

Muriel looks for a new version on GitHub when it starts. When a new version is available, a banner shows the update steps for your install type:

| Install type | How to update |
|---|---|
| AppImage | Click **Download and restart**. Muriel downloads the new AppImage, makes sure that the download is correct, and restarts. |
| Snap | Download the new `.snap` file. Then run the install command that the banner shows. Click **Copy command** to copy it. |
| Flatpak | Download the new `.flatpak` file. Then run the install command that the banner shows. Click **Copy command** to copy it. |
| Source code | Click **Update and restart**. Muriel runs `git pull`. When the dependencies changed, it also runs `npm ci`. |

The source code update works only on the `main` branch, and only when the folder has no changes that are not committed. This rule keeps your own changes safe.

From version 1.2.0 or older, update one time by hand. Later updates can start from the app.

## Your data

### Where Muriel keeps your data

Muriel keeps your data in one data folder. The location of the folder depends on your install type:

| Install type | Data folder |
|---|---|
| AppImage or source code | `~/.config/muriel-myfinancialadmin` |
| Snap | `~/snap/muriel-myfinancialadmin/current/.config/muriel-myfinancialadmin` |
| Flatpak | `~/.var/app/com.muriel.myfinancialadmin/config/muriel-myfinancialadmin` |

The data folder contains these files:

- `muriel-myfinancialadmin-state.json`: all your clients, invoices, expenses and profile details.
- `muriel-myfinancialadmin-state.backup.json`: a safety copy. Muriel writes it again when you save and when the app closes.
- `exchange-rates.json`: the ECB exchange rates that Muriel already got. Muriel uses them again, so it does not ask the ECB again.

Muriel encrypts the two state files with the key store of your desktop, for example GNOME Keyring or KWallet. If no key store is available, the files are not encrypted. **Profile** tells you which of the two is true on your computer.

### Back up and restore

1. To make a backup, click **Profile**, then click **Export backup**. Select where to save the file.
2. To restore a backup, click **Profile**, then click **Restore backup**. Select the backup file.

CAUTION: Keep backup files in a safe place. A backup file is not encrypted, so anyone who can open the file can read your data.

Muriel examines a backup before it restores it. It does not restore a file that has errors. It also does not restore a backup from a newer version of Muriel. In that case, update Muriel first.

## Number and date formats

Muriel shows amounts and dates in the formats of your desktop region settings. For numbers, it uses `LC_NUMERIC`. For dates, it uses `LC_TIME`. If these are not set, it uses `LANG`. For example, with `es_ES` formats, Muriel shows `12.345,00 €` and `10/03/2026`.

In an amount field, you can type a comma or a full stop as the decimal mark. For example, `12,50` and `12.50` are the same amount.

CSV exports always use dates such as `2026-03-10` and numbers such as `12345.5`, so that other programs can read them.

## Currencies and taxes

Muriel keeps your accounts in one currency, the book currency. You select the book currency in **Profile**. All reports use the book currency.

### Invoices in another currency

You can write an invoice in the currency of the client, for example USD. For an invoice in another currency:

- Muriel gets the ECB exchange rate of the issue date. If the work was done on another date, enter a **Service date**. Then Muriel uses the rate of the service date.
- You can type another exchange rate. Muriel records that you entered the rate by hand.
- The invoice and its PDF show the amounts in the currency of the client. They also show the exchange rate and the subtotal, VAT and total in the book currency. Spanish invoices must show the VAT in euros (RD 1619/2012, article 12.1).
- Muriel keeps the exchange rate with the invoice. A later edit does not get a new rate, unless you change the amount, the VAT rate, a currency or the rate.

### Income is the amount that arrived

When you mark an invoice paid, enter the amount that arrived in your bank account, after bank charges. Enter it in the book currency. The field starts with the invoice total in the book currency. This applies to all invoices, in all currencies.

- The income of a paid invoice is the amount that arrived, less the VAT.
- The income of an unpaid invoice is an estimate: its subtotal at the exchange rate of the invoice date.
- The VAT figures use the amounts at the exchange rate of the invoice date.

If you entered a wrong amount, click **More** > **Mark unpaid** on the invoice. Then mark it paid again with the correct amount.

### Expenses in another currency

You can record an expense in the currency of the receipt. Muriel gets the ECB exchange rate of the expense date. Then it fills in the amount paid in the book currency. Change this amount to the amount that left your bank account, after bank charges.

### Change the book currency

You can change the book currency from a date, for example after a move to another country. A change never changes the invoices and expenses that exist.

1. Click **Profile**.
2. Select the new **Book currency**.
3. In **Book currency from**, enter the first day of the new book currency.
4. Click **Save profile**.

The date must be after your last invoice or expense. A new invoice uses the book currency of its issue date. A new expense uses the book currency of its date.

A report for a period with two book currencies shows the totals of each book currency separately. Muriel never adds amounts in two currencies together.

To remove the last change, click **Remove the last change**. This is possible only when no invoice or expense uses the new book currency.

## Troubleshooting

### The AppImage does not start

Install the FUSE library, as [Install Muriel](#install-muriel) tells you. Then start the AppImage again.

### The command `nvm` is not found

1. Close the terminal and open a new one.
2. Run `nvm install 22.12.0` again.

### `npm install` stops with a Node.js version error

Select Node.js 22.12.0, then run `npm install` again:

```bash
nvm use 22.12.0
npm install
```

### `npm install` fails for another reason

Clear the npm cache, then run `npm install` again:

```bash
npm cache clean --force
npm install
```

### Muriel cannot get an exchange rate

Muriel needs an internet connection to get an ECB rate. The ECB publishes no rates on weekends and holidays, so Muriel uses the last rate before the date. If Muriel cannot get a rate, type the rate by hand.

### Muriel shows a warning that it cannot save

When Muriel cannot read your data files, it does not save changes. This rule keeps your data safe. Make a copy of the data folder before you do anything else. Then read the message in the warning.

## Development

### Run the app from the source code

Install Muriel from the source code, as [From the source code](#from-the-source-code) tells you. Then use these commands:

| Command | What it does |
|---|---|
| `npm start` | Starts the app. |
| `npm run lint` | Examines the code with ESLint. |
| `npm test` | Runs the unit tests. |
| `npm run test:e2e` | Runs the end-to-end tests. |

The end-to-end tests start the app, so they need a desktop session. Each test uses a new temporary data folder. The tests do not read or change your data in `~/.config/muriel-myfinancialadmin`.

Some end-to-end tests get exchange rates from the ECB. If the ECB does not answer, these tests are skipped.

GitHub Actions runs the lint, the unit tests and the release checks for each push and pull request.

### Build the packages

| Command | Output in `dist` |
|---|---|
| `npm run package:appimage` | `Muriel-myFinancialAdmin-<version>.AppImage` and `latest-linux.yml` |
| `npm run package:snap` | `muriel-myfinancialadmin_<version>_amd64.snap` |
| `npm run package:flatpak` | `Muriel-myFinancialAdmin-<version>-x86_64.flatpak` |
| `npm run package:linux` | All three packages |

Each command deletes the `dist` folder first. Then it examines the build configuration and the version number.

Before you build the Flatpak, install the Flatpak tools one time:

```bash
sudo apt install -y flatpak flatpak-builder
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
```

If the `dist` folder has a folder such as `__flatpak-x86_64` but no `.flatpak` file, the Flatpak tools are missing.

The Flatpak menu entry and metadata are in the `flatpak` folder.

## Publish a release

The release script builds the AppImage, the Snap and the Flatpak. Then it publishes them on GitHub with `latest-linux.yml`. The AppImage needs `latest-linux.yml` to update itself.

Before your first release, do these steps one time:

1. Install the Flatpak tools, as [Build the packages](#build-the-packages) tells you.
2. Log in to GitHub:

   ```bash
   gh auth login
   ```

To publish a release:

1. Set the new version in `package.json` and `package-lock.json`.
2. In `CHANGELOG.md`, change the `## Unreleased` heading to the new version, for example `## 1.4.0`.
3. Merge these changes into `main`.
4. Update your checkout of `main`.
5. Tag the release commit and push the tag:

   ```bash
   git tag v1.4.0
   git push origin v1.4.0
   ```

6. Do the checks in [RELEASE_QA_CHECKLIST.md](RELEASE_QA_CHECKLIST.md).
7. Publish the release:

   ```bash
   npm run release -- --title "v1.4.0 - short summary"
   ```

If a requirement is missing, the script stops before the build. It tells you what to correct. The release notes come from the section of `CHANGELOG.md` for the version.

To build and examine the packages without a publish, do a dry run:

```bash
npm run release -- --dry-run
```

## License

Muriel is available under the BSD 3-Clause license.
