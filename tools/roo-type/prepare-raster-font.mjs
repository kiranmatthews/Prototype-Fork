import fs from 'node:fs/promises';
const root=new URL('../../',import.meta.url),art=new URL('art/roo-reference-match/',root);
const source=JSON.parse(await fs.readFile(new URL('public/fonts/roo-bevel-source-v1.json',root),'utf8'));
const folder=new URL('raster-v6/',art);await fs.mkdir(new URL('prompts/',folder),{recursive:true});
const glyphs={};
for(const [char,g]of Object.entries(source.glyphs)){
 if(!g.commands.length)continue;
 const id='u'+char.codePointAt(0).toString(16).padStart(4,'0');
 const input=char==='0'?'zero-v5/zero-flat.png':`inputs/${id}-roo-shape.png`;
 const prompt=`Use case: sketch-to-render / style-transfer.\nAsset: exactly one polished Roo image-font glyph, ${JSON.stringify(char)}.\nImage 1 is the flat Roo letterform: preserve this character's identity, asymmetry, proportions, pointed terminals, openings and straight-on orientation. Image 2 is the approved zero and is the authoritative reference for FINISH, BEVEL CONSTRUCTION, MATERIAL AND LIGHTING only. Output only ${JSON.stringify(char)}; do not copy the zero's shape or accent.\nRender the entire glyph as one continuous carved body, with the same clean broad face and narrow sculpted chamfer as the approved zero. Let complete bevels and glints determine the finished contour; keep them intact, with generous transparent margins. Keep the glyph recognizably Roo. Do not crop away bevels to match a flat stencil.\nMatch the zero's rich golden-yellow upper face, smooth amber/orange middle and saturated red-vermilion foot. Match its restrained lemon-yellow highlights, carved facets, coherent top-left light and soft opposite fill. Keep the bevel about 3–4% of the cap height, with clean joins at every inner and outer corner. Use smooth continuous gradients and polished antialiased contours, including all holes and detached punctuation components. No blurry patches, banding, surface noise, scratches, extra facets, extra cuts, black outline or cast shadow. Do not inflate the face into tubing.\nReturn exactly one complete ${JSON.stringify(char)}, centered, on a truly transparent background with no painted checkerboard and no scene. No other letters, words, objects or decorations. This will be the actual finished glyph artwork, so every visible edge and bevel must be clean at high magnification.\n`;
 const promptFile=`raster-v6/prompts/${id}.txt`;
 try{await fs.access(new URL(promptFile,art));}catch{await fs.writeFile(new URL(promptFile,art),prompt);}
 glyphs[char]={input,prompt:promptFile,style:'candidates/0-counter-rebuild-v5.png',status:char==='0'?'generated':'pending',...(char==='0'?{model:'candidates/0-counter-rebuild-v5.png',generatorPrompt:'zero-v5/0-counter-rebuild-prompt.txt',generatedSource:'/Users/kiki/.codex/generated_images/01a08b3e-693b-7171-a2de-ce88b1cb0ff0/exec-5bbe0532-a733-45de-848c-1b9370832aff.png'}:{})};
}
const manifest=new URL('manifest.json',folder);
try{const prior=JSON.parse(await fs.readFile(manifest,'utf8'));for(const [char,g]of Object.entries(prior.glyphs))if(g.model)glyphs[char]=g;}catch{}
await fs.writeFile(manifest,JSON.stringify({version:6,basePalette:'counter',glyphs},null,2)+'\n');
console.log(JSON.stringify({glyphs:Object.keys(glyphs).length,pending:Object.entries(glyphs).filter(([,g])=>!g.model).map(([c])=>c).join('')}));
