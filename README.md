# Heyshift Demobox

An interactive, browser-only demo of Heyshift shift scheduling with sample data.
Plain HTML, CSS and JavaScript: no build step, no dependencies, no server code.

## Files
- `index.html`: page layout (top bar, tabs, guided checklist, shift dialog)
- `style.css`: all styling (emerald brand palette)
- `app.js`: the demo logic: sample locations and staff, schedule, leave, labor costs, attendance, staff app
- `favicon.svg`: icon

## Run it
- Quickest: open `index.html` in a browser.
- Or serve the folder with any static web server, for example:
  `python3 -m http.server 8080` then open http://localhost:8080
- Docker: `docker build -t demobox . && docker run -p 8080:8080 demobox`

## Notes
- Each visitor's changes are saved in their own browser (localStorage key `heyshift-demobox-v1`). "Reset demo" restores the sample data.
- Sample data (locations, staff, pay rates, revenue) is defined at the top of `app.js`.
- Trial buttons link to https://heyshift.io/free-trial (in `index.html`).
