const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// fix double state
code = code.replace(
  `const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);\n  const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);`,
  `const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);`
);

// fix double modal
const splitStr = '{/* How It Works Modal */}';
const parts = code.split(splitStr);
if (parts.length > 2) {
  // we have multiple modals. Just keep the first part, the first modal, and the rest after the second modal.
  // Actually, parts[0] + splitStr + parts[1] (which goes up to next splitStr). But we need to keep the second modal out.
  // Better to just delete everything between the first '{/* How It Works Modal */}' and the second one.
  const firstIndex = code.indexOf(splitStr);
  const secondIndex = code.indexOf(splitStr, firstIndex + 1);
  if (secondIndex !== -1) {
    code = code.substring(0, firstIndex) + code.substring(secondIndex);
  }
}

fs.writeFileSync('src/App.tsx', code);
console.log("Success");
