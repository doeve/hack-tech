const fs = require('fs');
const path = require('path');

function mapClasses(classStr) {
  let classes = classStr.split(/\s+/);
  let hasPrimaryBg = classes.some(c => c.startsWith('bg-blue-600') || c.startsWith('bg-blue-500') || c.startsWith('bg-green-500') || c.startsWith('bg-red-500'));
  
  classes = classes.map(c => {
    // Backgrounds
    if (c === 'bg-[#0b1120]' || c.startsWith('bg-[#0b1120]/')) return 'bg-slate-50';
    if (c.startsWith('bg-slate-800') || c.startsWith('bg-slate-900')) return 'bg-white';
    if (c.startsWith('bg-slate-700')) return 'bg-slate-100';
    if (c === 'bg-black') return 'bg-slate-900';
    
    // Borders
    if (c.startsWith('border-slate-700') || c.startsWith('border-slate-800')) return 'border-slate-200';
    if (c.startsWith('border-slate-600')) return 'border-slate-300';
    if (c === 'border-[#0b1120]') return 'border-white';
    
    // Primary brand (SkyGuide Dark Blue)
    if (c === 'bg-blue-600' || c.startsWith('bg-blue-600/')) return c.replace('bg-blue-600', 'bg-[#1e3a8a]');
    if (c === 'hover:bg-blue-500') return 'hover:bg-[#1e3a8a]/90';
    
    // Wait, things like bg-blue-500/10 are used for accents. Let's keep them blue but SkyGuide blue.
    // If it's a solid bg-blue-500, it becomes solid #1e3a8a.
    if (c === 'bg-blue-500') return 'bg-[#1e3a8a]';
    if (c.startsWith('bg-blue-500/')) return c.replace('bg-blue-500', 'bg-[#1e3a8a]');
    
    if (c === 'text-blue-400') return 'text-[#1e3a8a]';
    if (c === 'text-blue-500') return 'text-[#1e3a8a]';
    if (c === 'border-blue-400') return 'border-[#1e3a8a]';
    if (c === 'border-blue-400/50') return 'border-[#1e3a8a]/50';
    if (c.startsWith('border-blue-500/')) return c.replace('border-blue-500', 'border-[#1e3a8a]');
    if (c.startsWith('ring-blue-500/')) return c.replace('ring-blue-500', 'ring-[#1e3a8a]');
    if (c.startsWith('shadow-blue-600')) return c.replace('shadow-blue-600', 'shadow-blue-900');
    
    // Text colors
    if (c === 'text-white') {
        return hasPrimaryBg ? 'text-white' : 'text-slate-900';
    }
    if (c === 'text-slate-400') return 'text-slate-500'; // Make subtitles a bit darker on light BG
    if (c === 'text-slate-300') return 'text-slate-500';
    if (c === 'text-slate-500') return 'text-slate-600'; // Darker for readability
    if (c === 'text-slate-600') return 'text-slate-700';
    
    // Specific elements like active tabs (border-b-2 text-white -> text-[#1e3a8a])
    // The previous text-white -> text-slate-900 works for normal text, 
    // but in Flights tab, text-white was active tab. Now it's text-[#1e3a8a]? No, the tab bar bg is light.
    // Active tab in FlightsPage: 'text-white border-transparent' -> 'text-[#1e3a8a] border-[#1e3a8a]'?
    // Let's rely on manual fixes for specific semantics if they break.
    
    return c;
  });
  
  return classes.join(' ');
}

const applySkin = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace classNames strings
  // Match className="..."
  content = content.replace(/className="([^"]+)"/g, (match, classStr) => {
    return `className="${mapClasses(classStr)}"`;
  });

  // Match className={`...`}
  // This is a bit trickier because of interpolated variables ${...}
  // Let's do a loose split: anything between spaces or newlines that doesn't contain ${
  content = content.replace(/className=\{`([^`]+)`\}/g, (match, classStr) => {
    // split by ${...} manually or just map words that don't have $
    let parts = classStr.split(/(\$\{[^}]+\})/);
    parts = parts.map(part => {
      if (part.startsWith('${')) return part;
      // Map classes in the static part
      return mapClasses(part);
    });
    return `className={\`${parts.join('')}\`}`;
  });

  fs.writeFileSync(filePath, content, 'utf8');
};

const walkSync = (dir, filelist = []) => {
  if (!fs.existsSync(dir)) return filelist;
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.jsx')) {
        filelist.push(dirFile);
      }
    }
  });
  return filelist;
};

const pagesDir = 'c:/Users/Paul/hack-tech/frontend/src/pages';
const compDir = 'c:/Users/Paul/hack-tech/frontend/src/components';
let files = walkSync(pagesDir);
files = walkSync(compDir, files);

files.forEach(file => {
  applySkin(file);
});
console.log('JSX skin applied to ' + files.length + ' files.');
