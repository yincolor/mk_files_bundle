// import { BundleReader, readStreamToLocalFile } from "../read_bundle";
import { BundleReader } from "../read_bundle.ts";
import path from "node:path";
import fs from "node:fs";


const b = new BundleReader(path.resolve(import.meta.dir, '../../output/pack.bin'));

async function main() {
    
    await b.init(); 
    const read_obj = await b.read('/www/老视频1.mp4'); 
    if(read_obj != null){
        if(read_obj.dataType === 'Uint8Array'){
            fs.writeFileSync('./1.mp4', read_obj.data); 
        }else {
            console.log(read_obj.dataType);
            const reader = read_obj.data.getReader();
            while(true){
                const res = await reader.read();
                if(res.done){
                    break;
                }else{
                    fs.appendFileSync('1.mp4', res.value)
                }
            }
        }
    }
}
main(); 


/*
文件元数据长度: 56676
Uint8Array(8) [ 100, 221, 0, 0, 0, 0, 0, 0 ]
56676

*/