import assert from 'node:assert/strict';
import ts from 'typescript';
import * as THREE from 'three';

/** Execute the actual app atmosphere/backdrop functions with real Three
 * scene/light state. Only image loading, postprocessing and canvas sky output
 * are replaced; capture the fallback painter's actual input for inspection. */
export function atmosphereRenderer(mainSource, atmosphereModule) {
  const ast = ts.createSourceFile('main.ts', mainSource, ts.ScriptTarget.Latest, true);
  const getFunction = name => {
    const node = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
    assert.ok(node, `missing actual renderer function ${name}`); return node.getText(ast);
  };
  const presetNode = ast.statements.find(n => ts.isVariableStatement(n) &&
    n.declarationList.declarations.some(d => d.name.getText(ast) === 'SKY_PRESETS'));
  const code = ts.transpileModule(`${presetNode?.getText(ast) ?? 'const SKY_PRESETS = atmosphereModule.SKY_PRESETS;'}\n${getFunction('syncSkyBackdropVisibility')}\n${getFunction('applyTheme')}`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return new Function('level', 'current', 'settings', 'THREE', 'atmosphereModule', `
    const DEFAULT_SKY='sunset', LITE=settings.lite??false, NO_COAST_POST=true, shellBypass=true;
    const editorViewActive=settings.editor??false;
    const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(), camera2=new THREE.PerspectiveCamera();
    camera.far=camera2.far=settings.editor?1234:400;
    const hemi=new THREE.HemisphereLight(),sun=new THREE.DirectionalLight(),fill=new THREE.DirectionalLight();
    const sky=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial());
    const skyMist=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial());
    const skyCache=new Map(settings.painted===false?[]:['day','sunset','night','coast'].map(k=>[k,{bg:new THREE.Texture(),mist:new THREE.Texture()}]));
    const releaseBonusParallax=()=>{},retainOnlyActiveSky=()=>{},loadSky=()=>{},configureCoastPost=()=>{};
    const visualTreatmentActivity=()=>({any:false}),visualTreatmentSettings={value:{}};
    const ensureBonusParallax=()=>({visible:true,setVisible(){},reset(){}}),player={pos:new THREE.Vector3()},loadedLevelId=current.id;
    const {resolveLevelAtmosphere,atmosphereColor,atmosphereColorHex}=atmosphereModule;
    let activeSky='sunset',levelPostEnabled=false,proceduralSky=null,proceduralSkyKey='',fallback=null;
    const makeSkyTexture=theme=>{fallback={skyTop:theme.skyTop,skyBottom:theme.skyBottom,fog:theme.fog,
      stars:theme.stars,sunColorHex:theme.sunColorHex,sunU:theme.sunU,sunV:theme.sunV};return new THREE.Texture();};
    ${code}
    applyTheme();
    return {fog:scene.fog?{near:scene.fog.near,far:scene.fog.far,color:scene.fog.color.toArray()}:null,
      background:scene.background.toArray(),drawDistance:camera.far,secondDrawDistance:camera2.far,
      ambientSky:hemi.color.toArray(),ambientGround:hemi.groundColor.toArray(),ambientIntensity:hemi.intensity,
      sunColor:sun.color.toArray(),sunIntensity:sun.intensity,shadowStrength:sun.shadow.intensity,
      fillColor:fill.color.toArray(),fillIntensity:fill.intensity,skyVisible:sky.visible,mistVisible:skyMist.visible,fallback};
  `).bind(null);
}
