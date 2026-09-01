# HayatBridge Patient Portal

Build a professional healthcare web app called HayatBridge. This app is a patient-centered medical record sharing system designed for patients, doctors, pharmacists, and hospitals. The purpose of the app is to help patients store their important health information in one place and share it securely with healthcare providers through a QR code. The product should feel like a real hospital or clinical portal, not a casual app. It must look trustworthy, clean, modern, and highly professional.*

*The app should support a secure password login system, and optionally a PIN or additional security step for sensitive access. A patient should be able to create an account, sign in securely, fill in their basic health information, and generate a QR code that can be scanned by doctors, pharmacists, or hospital staff. When the QR code is scanned, the viewer should only be able to see the patient summary that the patient has approved for sharing. The patient must stay in control of access at all times. Include a consent system, access logs, and a way to revoke access.*

*The app should be organized around these main features:*

- Patient signup and secure login.

- Patient dashboard with medical summary.

- QR code generation and sharing.

- Doctor scan flow.

- Pharmacist scan flow.

- Hospital staff summary view.

- Consent and privacy controls.

- Access history and logs.

*Use the attached UI design as the style reference. Match the overall hospital patient portal feel, including the layout structure, spacing, card style, rounded corners, large action tiles, and clean organization. I want the design to feel similar to a real healthcare portal where the screen is easy to scan and the main actions are clearly visible. Use a top header, a welcome message, and large square or rounded cards for the most important actions, with a clean updates or notices section underneath.*

*The visual style should be:*

- Clean.

- Minimal.

- Professional.

- Healthcare-focused.

- Easy to use.

- Trustworthy.

- Responsive for desktop and mobile.

*Color direction:* I want the app to feel more like a hospital system, so use *blue and white* as the main colors. Blue should be the primary brand and action color because it feels calm, medical, and trustworthy. White should be the main background. Use soft grey for secondary sections and cards. Use green only for success states, and use red only for alerts, warnings, or urgent messages. Avoid making the whole app red and white, because that feels more alarming than medical. The overall presentation should feel more like a hospital patient portal than a social app or startup landing page.

*Core user flow:*  

1. The patient signs up and logs in securely.  

2. The patient enters essential health information such as allergies, medicines, diagnoses, and recent reports.  

3. The app generates a QR code for the patient.  

4. The patient shares the QR code with a doctor, pharmacist, or hospital.  

5. The doctor or pharmacist scans the QR code and sees only the approved summary.  

6. The patient controls who can access the data and for how long.  

7. The app records access logs so the patient can see who viewed the data and when.  

8. The experience should feel smooth, simple, and secure from start to finish.

*Required screens:*

1. *Landing page* with the HayatBridge logo, a hospital-style hero section, and a short explanation of the app.

2. *Signup/Login screen* with secure password-based authentication and a clean medical UI.

3. *Patient dashboard* with summary cards for allergies, medicines, lab reports, diagnoses, and a QR code section.

4. *Consent screen* where the patient can choose who can view the data, how long access lasts, and whether to revoke access.

5. *Doctor view* that allows QR scanning and displays the approved patient summary clearly.

6. *Pharmacist view* that shows medicine history and allergies in a simple, readable format.

7. *Hospital staff view* that shows a concise patient record summary for clinical use.

8. *Access log screen* that lists who accessed the data, when they accessed it, and what was viewed.

*Interaction and UX rules:*  

- Keep the navigation simple and intuitive.  

- Make the main actions obvious with large buttons and clear labels.  

- Use icon-based cards for quick access to major features.  

- Make forms short and easy to complete.  

- Make the UI feel polished, calm, and serious.  

- Avoid playful colors, cartoonish visuals, or overly trendy layouts.  

- The app should feel like a serious healthcare product that could be used by clinics and hospitals.

*Please design the interface so it feels like a premium health-tech product with a hospital portal style. It should look polished enough to show in a presentation or demo, with clean typography, balanced spacing, clear hierarchy, and professional visuals.*

## Optional addition

If you want, you can also include this line:

*Make the dashboard feel inspired by a real patient portal, with a welcoming header, large action tiles, and a section for updates or notices below the main cards.*

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://hayat-bridge.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/60f1f4cb-1935-4837-8263-f2787a6c825d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
