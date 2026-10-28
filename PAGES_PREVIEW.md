# Fox Optimiser · automatically published Safari preview

The GitHub Actions workflow at `.github/workflows/pages-preview.yml` publishes a **read-only static preview** from `main` whenever changes are pushed or merged. The hosted preview is independent of the Codespaces Python server and does not require local Git Pull.

## One-time repository setting

GitHub Pages must be enabled by a repository administrator:

1. Open [the repository Pages settings](https://github.com/roster-buddy/FOX-OPTIMISER/settings/pages) while signed in to GitHub.
2. Under **Build and deployment → Source**, select **GitHub Actions**.
3. If deployment does not start by itself, open **Actions → Fox Optimiser Safari preview → Run workflow** on `main`.

Once the deployment succeeds, the expected hosted URL is:

**https://roster-buddy.github.io/FOX-OPTIMISER/**

GitHub may take a short time to publish new deployments. Reload Safari to obtain a newly deployed version.

## Safety and what gets published

The packaging script scans the production `index.html` and copies only its locally referenced static JS/CSS/icon/manifest assets, together with the clearly labelled `fox-test-v09-data.json` sample data. The `preview-v2.html` hosted path is a copy of the production HTML. This avoids the Codespaces-specific cache clearing routine and does **not** upload Python server files, shell scripts, backup files, test sources, development documentation, local secrets or the `sw.js` legacy service worker.

The script updates static asset URLs with a version derived from the commit SHA so Safari does not reuse the previous app JS/CSS indefinitely. A deployment updates the hosted files; an already open tab may need refreshing.

**The public Pages preview is not Home Assistant and has no live Fox ESS API, Ohme or Octopus account integration.** It does not control the inverter or alter charging schedules. Public published Agile prices are separate from actual measured accounting; no credentials are inserted into the public preview.

### Local Codespaces preview

Existing private Codespaces port 8000 remains available for testing the local working tree. GitHub Pages follows the committed `main` branch; Codespaces changes are not present until committed and pushed.
