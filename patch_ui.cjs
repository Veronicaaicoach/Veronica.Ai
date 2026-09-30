const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Replace value and label in dropdown
code = code.replace(
  /<option className="bg-\[#1A1A1A\] text-white" value="Confidence building">\s*\{!isPremium \? '🔒 ' : ''\}Confidence Building \{!isPremium \? '\(Premium\)' : ''\}\s*<\/option>/g,
  `<option className="bg-[#1A1A1A] text-white" value="Approach skills">\n                          {!isPremium ? '🔒 ' : ''}Approach Skills {!isPremium ? '(Premium)' : ''}\n                        </option>`
);

// Replace description condition and text
code = code.replace(
  /\{personality === 'Confidence building' && \(\s*<p className="text-\[11px\] text-emerald-300\/80 mt-3 max-w-xs mx-auto font-light leading-relaxed">\s*Overcoming hesitation, handling awkward moments & progressive social challenges\s*<\/p>\s*\)\}/g,
  `{personality === 'Approach skills' && (
                      <p className="text-[11px] text-emerald-300/80 mt-3 max-w-xs mx-auto font-light leading-relaxed">
                        Build confidence to approach women, start interactions, and handle nervousness naturally.
                      </p>
                    )}`
);

// Update error message
code = code.replace(
  /'This coaching module is locked on the Free Tier\. Unlock Premium to access Flirting Practice and Confidence Building\.'/g,
  `'This coaching module is locked on the Free Tier. Unlock Premium to access Flirting Practice and Approach Skills.'`
);

// Update How It Works text
code = code.replace(
  /Choose from Practice Conversations, Dating Advice, Flirting Practice, or Confidence Building\./g,
  `Choose from Practice Conversations, Dating Advice, Flirting Practice, or Approach Skills.`
);

// Update premium lock text below dropdown
code = code.replace(
  /Flirting & Confidence modules require a Premium pass/g,
  `Flirting & Approach modules require a Premium pass`
);

fs.writeFileSync('src/App.tsx', code);
console.log("Success");
