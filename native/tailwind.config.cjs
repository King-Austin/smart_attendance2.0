module.exports = {
 content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'], presets: [require('nativewind/preset')], darkMode: 'class',
 theme: { extend: {
 colors: Object.fromEntries(['background','foreground','card','primary','secondary','muted','muted-foreground','border','success','warning','destructive'].map(key => [key, `rgb(var(--${key}) / <alpha-value>)`])),
 borderRadius: { '3xl': 28, '2xl': 20 }, fontFamily: { sans: ['Geist'] }
 } }, plugins: []
};
