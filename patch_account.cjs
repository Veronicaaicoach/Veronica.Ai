const fs = require('fs');

let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// Ensure User is imported
if (!code.includes('User,')) {
  code = code.replace(/import \{([^}]+)\} from 'lucide-react';/, "import {$1, User} from 'lucide-react';");
}

code = code.replace(
  `<Settings className="w-5 h-5" />`,
  `<User className="w-5 h-5" />`
);

fs.writeFileSync('src/components/Sidebar.tsx', code);
console.log("Success");
