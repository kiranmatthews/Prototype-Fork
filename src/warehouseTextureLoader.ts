import type {WebGLRenderer} from 'three';
import type {KTX2Loader} from 'three/examples/jsm/loaders/KTX2Loader.js';
import {sceneryTextureLoader} from './sceneryTextureLoader';
let loader:KTX2Loader|null=null;
export function configureWarehouseAssetRenderer(renderer:WebGLRenderer):void {loader=sceneryTextureLoader(renderer);}
export function warehouseTextureLoader():KTX2Loader|null {return loader;}
