# Installation Step By Step Instructions

This guide is written for complete beginners.

## Super Quick Install (1 minute)

If you already have a `.AppImage` file, do only these steps:

1. Put the `.AppImage` file in `Downloads`.
2. Right-click the file, then click `Properties`.
3. Open `Permissions` and turn on `Allow executing file as program`.
4. Close the window and double-click the file.

If it does not open, right-click the file and choose `Run as Program`.

Then come back to the full guide below only if you need help.

If you do not have a `.AppImage` yet, use one of these:

1. Download it from the release/download page where this app is shared (look for a file ending in `.AppImage`).
2. Build it yourself using the "Optional: Create a Linux AppImage From This Project" section below.

## Choose One Installation Method

Use one of these:

1. Easy method (recommended): use a ready `.AppImage` file.
2. Full method: install from the project folder (source code).

If you already have a file ending in `.AppImage`, use the easy method.

---

## Method 1: Easy Install With AppImage

Before you start this method, make sure you already downloaded a `.AppImage` file.
If you are not sure where your browser saved it, check the `Downloads` folder first.

1. Save the `.AppImage` file in your `Downloads` folder.
2. Open the `Files` app and go to `Downloads`.
3. Right-click the `.AppImage` file.
4. Click `Properties`.
5. Open the `Permissions` tab.
6. Turn on: `Allow executing file as program`.
7. Close the properties window.
8. Double-click the `.AppImage` file to open the app.

If double-click does not open it:

1. Right-click the `.AppImage` file.
2. Click `Run as Program`.

If it still does nothing, your Linux system may be missing AppImage support.
Open Terminal and install it with:

```bash
sudo apt update
sudo apt install -y libfuse2
```

Then try opening the `.AppImage` again.

You are done.

---

## Method 2: Install From Project Folder (Source Code)

### Part A: Open Terminal

1. Press `Ctrl + Alt + T` on your keyboard.
2. A Terminal window opens.
3. You will type commands there.
4. Press `Enter` after each command.

### Part B: Install Node.js (Required)

This app needs Node.js version `22.12.0` or newer.

1. Run:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
```

2. Close Terminal.
3. Open Terminal again.
4. Run:

```bash
nvm install 22.12.0
nvm use 22.12.0
```

5. Check the version:

```bash
node -v
```

You should see `v22.12.0` (or newer in the 22.x line).

### Part C: Open the Project Folder in Terminal

1. Find the project folder on your computer.
2. Open that folder in your `Files` app.
3. Right-click inside the folder background.
4. Click `Open in Terminal` (or `Open Terminal Here`).

If you do not see that option, use this method:

1. Open Terminal.
2. Type `cd ` (with one space after it).
3. Drag your project folder from `Files` into Terminal.
4. Press `Enter`.

You can check that you are in the right folder by running:

```bash
pwd
```

### Part D: Install Dependencies

1. Run:

```bash
npm install
```

Wait until it finishes.

### Part E: Start the App

1. Run:

```bash
npm run start
```

The desktop app window should open.

You are done.

---

## Optional: Create a Linux AppImage From This Project

1. In Terminal, inside the project folder, run:

```bash
npm run package:linux
```

2. When it finishes, confirm the file was created:

```bash
ls -lah dist/*.AppImage
```

3. The AppImage is created in the `dist` folder, for example:

```text
dist/Muriel - myFinancialAdmin-1.0.0.AppImage
```

4. Make it executable:

```bash
chmod +x dist/*.AppImage
```

5. Run it from Terminal:

```bash
./dist/*.AppImage
```

6. Or open your `dist` folder in the Files app and use Method 1 steps to run it.

---

## If Something Goes Wrong

### Problem: `nvm: command not found`

1. Close Terminal.
2. Open Terminal again.
3. Run the `nvm install` and `nvm use` commands again.

### Problem: `Unsupported Node.js version`

1. Run:

```bash
nvm use 22.12.0
```

2. Try your previous command again.

### Problem: `npm install` fails

1. Run:

```bash
npm cache clean --force
npm install
```

### Problem: App does not open

1. Run again:

```bash
npm run start
```

2. Read the error shown in Terminal.

### Problem: AppImage does nothing when double-clicked

This usually means FUSE support is missing.

1. Run:

```bash
sudo apt update
sudo apt install -y libfuse2
```

2. Try opening the `.AppImage` again.
