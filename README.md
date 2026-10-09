![Project 2 Screenshot](https://github.com/Scott-TechStar/Scott-TechStar.github.io/blob/main/sources/images/SkillScroll.png)
<!DOCTYPE html>
<html>
<head>
  
  <link rel="stylesheet" href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css">
</head>
<body>

<div class="container mt-5">
  <strong><h1 class="display-4"><i>Skill Scroll Website</i></h1></strong>
  <p class="lead">Discover, Learn, and Showcase Your Skills with ScottVentures</p>
</div>

<div class="container mt-5">
  <h2>Features</h2>
  <ul>
    <li>Skill Library: Explore a wide range of skills.</li>
    <li>User Profiles: Track your progress and showcase your skills.</li>
    <li>Community Interaction: Connect with other learners.</li>
    <li>Skill Challenges: Test and improve your abilities.</li>
  </ul>
</div>

<div class="container mt-5">
  <h2>Getting Started</h2>
  <ol>
    <li>Clone this repository: <code>git clone https://github.com/your-username/skill-scroll.git</code></li>
    <li>Set up the database once: follow <a href="supabase/README.md"><code>supabase/README.md</code></a> (create a free Supabase project, run <code>supabase/schema.sql</code>, paste your URL + anon key into <code>sources/js/supabase-config.js</code>).</li>
    <li>Preview locally with any static server (<code>npx serve .</code>), or publish the repo with GitHub Pages — no backend server is needed.</li>
    </ol>
</div>

<div class="container mt-5">
  <h2>Usage</h2>
  <p>
    <strong>Browse Skills:</strong> Discover and learn new skills.
    <br>
    <strong>User Profile:</strong> Showcase your skills and track your learning journey.
    <br>
    <strong>Skill Challenges:</strong> Test your skills and earn badges.
    <br>
    <strong>Community:</strong> Engage with other users and collaborate on projects.
  </p>
</div>

<div class="container mt-5">
  <h2>Contributing</h2>
  <ol>
    <li>Fork this repository.</li>
    <li>Create a new branch for your feature: <code>git checkout -b feature-name</code></li>
    <li>Make your changes and commit them: <code>git commit -m "Add feature-name"</code></li>
    <li>Push your changes to your fork: <code>git push origin feature-name</code></li>
    <li>Create a pull request to the main branch of this repository.</li>
  </ol>
</div>

<div class="container mt-5">
  <h2>License</h2>
  <p>This project is licensed under the <a href="LICENSE">MIT License</a>.</p>
</div>

<div class="container mt-5 mb-3">
  <p class="text-center">
    Feel free to reach out to us at <a href="mailto:johnniekips@gmail.com">contact@scottvetures.com</a> for any questions or feedback.k.
    <br>
    Happy learning and skill-building!
  </p>
</div>

</body>
</html>

---

## Integration notes (added)

Original content from **Project 1 (ScottVentures)** has been merged
directly into this site, restyled to match ScottVentures's existing
look — no separate section, no separate nav item.

- **`/Articles/`** now holds all 11 articles: the 2 original
  ScottVentures articles plus 9 ScottVentures tech explainers (regex,
  git aliases, motherboards, SATA vs NVMe, terminal tricks, etc.).
  All 11 share one look — `Articles/articles.css` — including the
  two original articles, which had their own one-off inline
  `<style>` blocks removed so everything renders consistently.
- **Reactions & comments work on all 11 articles**, wired to
  `/Backend/` (Express + SQLite). See `Backend/readme.md` for setup —
  run `npm install && npm start` inside `Backend/`, then the
  like/dislike buttons and comment form on every article page work
  against `http://localhost:4000`. Update `API_BASE_URL` in
  `Articles/articles.js` once you deploy it for real.
- **Accounts are real, not decorative.** `Backend/routes/auth.js`
  adds registration/login/session endpoints (passwords hashed with
  Node's built-in `crypto.scrypt` — no extra dependency). The
  Register and Sign In pages (`Account/register.html`,
  `Account/login.html`) submit to that API via `Account/account.js`.
  On every page, the "Account" nav link (`sources/js/session.js`)
  checks the signed-in state and swaps to "Hi, `<name>` (Logout)"
  once you're logged in.
- All internal navigation (nav bars, article cards, the Account
  link) was converted from hardcoded `https://Scott-TechStar.github.io/…`
  URLs to relative paths, so the site works as a self-contained local
  or self-hosted copy instead of silently linking out to the live
  deployed site.

**Left out on purpose:** Project 1's `PDFTools/` folder was not
integrated — its code (CSS/JS bundles, CSRF tokens, App Store ID) is a
rebranded copy of iLovePDF's commercial product, not original content,
so it wasn't safe to fold into this site. Project 1's own Home/About/
Contact pages were also left out since ScottVentures already has its own
versions of those and merging both would create a duplicated,
confusing site identity — the articles were the part with no
equivalent already in ScottVentures.
