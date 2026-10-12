Auth image slider assets
=========================

The Sign In / Sign Up slider (src/components/auth/AuthSlider.jsx) looks for:
  Login carousel images are bundled from frontend/src/assets/auth/slide-*.png
  (see AuthSlider.jsx). Legacy copies may remain here for dev-only direct URLs.

If these files are missing, the slider automatically falls back to themed
gradient slides, so the pages still work.

Three ready-made manufacturing photos were generated for this slider at:
  C:\Users\satee\.cursor\projects\c-Users-satee-OneDrive-Desktop-GNS-Insights\assets\auth-slide-1.png
  ...\auth-slide-2.png
  ...\auth-slide-3.png

To use them, copy them into this folder (run from the project root in PowerShell):

  Copy-Item "$HOME\.cursor\projects\c-Users-satee-OneDrive-Desktop-GNS-Insights\assets\auth-slide-1.png" "frontend\public\auth\slide-1.png"
  Copy-Item "$HOME\.cursor\projects\c-Users-satee-OneDrive-Desktop-GNS-Insights\assets\auth-slide-2.png" "frontend\public\auth\slide-2.png"
  Copy-Item "$HOME\.cursor\projects\c-Users-satee-OneDrive-Desktop-GNS-Insights\assets\auth-slide-3.png" "frontend\public\auth\slide-3.png"

You can also drop in your own images using the same names.
