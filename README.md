# Photo Sorter

A lightweight browser-based photo browser that groups images into Google Photos-style date sections:

- Years in descending order
- Months in descending order within each year
- An `Unknown` section at the end for photos without a valid year
- Year and month dropdown filters based on the uploaded images
- A lightbox with EXIF-based photo details and map links when GPS data exists

## Project Structure

```text
photo-sorter/
  app.js
  db.js
  index.html
  server.js
  style.css
```

## Local Development

Requirements:

- Node.js 18+

Run locally:

```bash
npm install
npm run dev
```

Then open [http://localhost:8123](http://localhost:8123).

## GitHub

Suggested repo flow:

1. Create a new GitHub repository.
2. Push this folder as the repository root.
3. Keep Netlify publishing from `photo-sorter`.

## Netlify Deployment

This repo includes a `netlify.toml` configured for static hosting.

Netlify settings:

- Base directory: leave empty
- Publish directory: `photo-sorter`
- Build command: leave empty

You can also connect the GitHub repo directly and let Netlify read the config automatically.

## Notes

- Photo grouping uses embedded EXIF date when available.
- If EXIF date is missing, the app falls back to a detectable date in the filename or folder path.
- Years earlier than `2003` or later than the current system year are treated as `Unknown`.

