# Virasat

**An interactive guide to traditional Indian painting forms.**

Virasat is a static educational website for exploring painting traditions associated with Indian states and union territories. Visitors can explore an interactive map, choose an art form, read its description, and browse a picture deck.

Live Website:
https://indian-art-forms-mocha.vercel.app/
## Features

- Interactive map with art-form names for each listed region
- State and art-form selectors linked to the image gallery
- Image deck with available captions, credits, and source details
- Responsive layout for desktop and mobile screens
- No build tools or package installation required

## Tech stack

- HTML5 for the page structure
- CSS3 for styling and responsive layouts
- Vanilla JavaScript for the interactive map and gallery
- WebP for the optimized gallery images

## Project files

```text
index.html                    Website page
style.css                     Layout, colors, and motif styling
main.js                       Map and gallery interactions
js/
  dataset-catalog.js          Region, art-form, and image catalog
  art-form-descriptions.js    Art-form descriptions and sources
  paintings-data.js            Featured painting data
images/                       Map and background assets
indian-paintings-web/          Optimized gallery images
```

Keep the image folders and their subfolders in place. The catalog uses relative paths to find the gallery images.

## Run locally

Open `index.html` in a web browser. There is no build step.

## Image credits

Image credits and source details are shown when they are available in the catalog. Check the information for each image before reusing it elsewhere.
