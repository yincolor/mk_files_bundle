import type { BunFile } from "bun";
import fs from "node:fs";
import { cryptoUtil, uint8ArrayToNumber } from "./crypto.ts"; 


// export const bundleFile = Bun.file('../output/pack.bin'); 

export class BundleReader {
    bundleFilePath: string = "";
    /** 打包文件的路径 */
    bundleFile: BunFile;
    /** 虚拟文件的元数据列表 */
    FileMetaTree: FileMetaType[] = [];
    /** 解密密码，默认为null，即无需解密 */
    pwd: string | null = null;
    /** 存储区的开始索引 */
    saveAreaStartIndex:number = -1
    /** 是否加密 */
    isCripto: boolean = false;
    constructor(_bundleFilePath: string) {
        const stats = fs.statSync(_bundleFilePath);
        if (stats.isFile()) {
            // 存在这个文件
            if (stats.size <= 0) {
                throw new Error("[BundleReader.constructor] Error: Bundule File Size is 0 !!! Please check if the file exists !!!");
            }
            // 初始化
            this.bundleFilePath = _bundleFilePath;
            this.#initVirtualFileMeta(_bundleFilePath);
            console.log(`[BundleReader.constructor] 元数据已读取 ${this.FileMetaTree.length}`);
            this.bundleFile = Bun.file(_bundleFilePath);
        } else {
            throw new Error(`[BundleReader.constructor] Error: File Not Found ${_bundleFilePath}`);
        }
    }

    /** 初始化虚拟文件的元数据 */
    #initVirtualFileMeta(bundleFilePath: string) {
        const bundleFileHandler = fs.openSync(bundleFilePath, 'r');

        const metaSizeBuffer = Buffer.alloc(4, 0, 'binary');
        fs.readSync(bundleFileHandler, metaSizeBuffer, 0, 4, 6);
        const metaSizeData = new Uint8Array(metaSizeBuffer); //await (this.bundleFile.slice(6, 10, "application/octet-stream")).bytes();
        // console.log(metaSizeData);
        const metaSize = uint8ArrayToNumber(metaSizeData);
        console.log('元数据长度：', metaSize);
        this.saveAreaStartIndex = metaSize + 10; // 相当于前面的元数据存储区的结尾就是文件数据存储区
        const metaEncryptBuffer = Buffer.alloc(metaSize, 0, 'binary');
        fs.readSync(bundleFileHandler, metaEncryptBuffer, 0, metaSize, 10);
        const metaEncryptData = new Uint8Array(metaEncryptBuffer); // await (this.bundleFile.slice(10, metaSize, "application/octet-stream")).bytes();

        const decodeByteBuffer = Buffer.alloc(1, 0, 'binary');
        fs.readSync(bundleFileHandler, decodeByteBuffer, 0, 1, 4);
        const decodeByte = (new Uint8Array(decodeByteBuffer))[0]; //(await (this.bundleFile.slice(4, 5, "application/octet-stream")).bytes())[0];
        fs.closeSync(bundleFileHandler);

        const decoder = new TextDecoder();
        const metaBase64Str = decoder.decode(cryptoUtil.xor(metaEncryptData, decodeByte));

        const meta: { tree: FileMetaType[], pwd: string | null } = JSON.parse(cryptoUtil.base64.decode(metaBase64Str));
        // console.log(JSON.stringify(meta));
        
        this.FileMetaTree = meta.tree;
        this.pwd = meta.pwd;
        if (this.pwd) {
            console.log(`[BundleReader.initVirtualFileMeta] 获取解密密码: ${this.pwd}`);
            
            this.isCripto = true;
        }
    }

    /** 根据虚拟路径获取文件元数据 */
    getVirtualFileMeta(virtualPath: string) {
        const dirLevelArray = virtualPath.split("/");
        const dirLevelArrayLength = dirLevelArray.length;
        if (dirLevelArrayLength <= 1) {
            console.log(`[BundleReader.getVirtualFileMeta] Error: Virtual File Not Found!!! ${virtualPath}`);
            return null;
        }
        console.log(`[BundleReader.getVirtualFileMeta] dirLevelArrayLength = ${dirLevelArrayLength}`);
        let fileMetaTree = this.FileMetaTree;
        for (let i = 1; i < dirLevelArrayLength; i++) {
            for (const fileMeta of fileMetaTree) {
                if (i != (dirLevelArrayLength - 1)) {
                    // 还不是最后一级的文件，因此必须从目录中找
                    if (fileMeta.type === 'folder' && fileMeta.name === dirLevelArray[i]) {
                        fileMetaTree = fileMeta.children;
                        break;
                    }
                } else {
                    // 最后一级，找文件
                    if (fileMeta.type === 'file' && fileMeta.name === dirLevelArray[i]) {
                        return fileMeta;
                    }
                }
            }
        }
        return null;
    }
    /** 读取打包文件中的一个文件 */
    async read(virtualPath: string): Promise<{ mimeType: string, readSize: number, dataType: 'Uint8Array', data: Uint8Array } | { mimeType: string, readSize: number, dataType: 'ReadableStream', data: ReadableStream } | null> {
        const fileMeta = this.getVirtualFileMeta(virtualPath);
        if (fileMeta === null) {
            return null;
        } else {
            const saveSize = fileMeta.saveSize;
            const saveIndex = fileMeta.saveIndex;
            const mimeType = fileMeta.mimeType;
            console.log(`[BundleReader.read] ${fileMeta.name} ${saveSize} ${saveIndex}`);
            
            let decryptoKey: CryptoKey | null;
            let decryptoIV: Uint8Array | null;
            if (this.isCripto && this.pwd) {
                const { key, iv } = await cryptoUtil.aes.generateKey(this.pwd);
                console.log(`[BundleReader.read] 获取解密密码: ${this.pwd}`); 
                decryptoKey = key;
                decryptoIV = iv;
            } else {
                decryptoKey = null;
                decryptoIV = null;
            }
            
            if (saveSize && Array.isArray(saveSize) === false && Array.isArray(saveIndex) === false) {
                // 小文件直接读取返回
                console.log(`[BundleReader.read] 读取小文件 ${fileMeta.name} 字节长度: ${saveSize} 开始位置: ${saveIndex}`);
                
                const data = await this.bundleFile.slice(this.saveAreaStartIndex + saveIndex, this.saveAreaStartIndex + saveIndex + saveSize, "application/octet-stream").bytes();
                console.log(`[BundleReader.read] 读取长度: ${data.byteLength} 字节`);
                
                let outData = data;
                if (this.isCripto && this.pwd && decryptoKey && decryptoIV) {
                    outData = await cryptoUtil.aes.decrypt(data, decryptoKey, decryptoIV);
                    console.log(`[BundleReader.read] 解密长度: ${outData.byteLength} 字节`);
                }
                return { mimeType, readSize: outData.byteLength, dataType: 'Uint8Array', data: outData };
            } else {
                // 大文件返回一个可读流
                if (Array.isArray(saveSize) === false || Array.isArray(saveIndex) === false) {
                    return null;
                }
                const data = new ReadableStream({
                    start: (controller) => {
                        async function pushData(filePath: string, saveAreaStartIndex:number, saveSize: number[], saveIndex: number[], decryptoInfo: { key: CryptoKey, iv: Uint8Array } | { key: null, iv: null }) {
                            const fileHandler = fs.openSync(filePath, 'r');
                            for (let i = 0; i < saveSize.length; i++) {
                                const buffer = Buffer.alloc(saveSize[i], 0, 'binary');
                                fs.readSync(fileHandler, buffer, 0, saveSize[i], saveAreaStartIndex + saveIndex[i]);
                                const data = new Uint8Array(buffer);
                                let outData = data;
                                if (decryptoInfo.key) {
                                    // 需要解密
                                    outData = await cryptoUtil.aes.decrypt(data, decryptoInfo.key, decryptoInfo.iv)
                                }
                                controller.enqueue(outData);
                            }
                            controller.close();
                        }
                        if (decryptoKey === null || decryptoIV === null) {
                            pushData(this.bundleFilePath, this.saveAreaStartIndex, saveSize, saveIndex, { key: null, iv: null });
                        } else {
                            pushData(this.bundleFilePath, this.saveAreaStartIndex, saveSize, saveIndex, { key: decryptoKey, iv: decryptoIV });
                        }
                    }
                });
                return { mimeType, readSize: fileMeta.realSize, dataType: 'ReadableStream', data };
            }
        }
    }
}

/** 虚拟文件元数据 */
type FileMetaType = {
    fileReadPath?: string,
    name: string,
    realSize: number,
    type: 'file',
    mimeType: string,
    saveIndex: number | number[],
    saveSize: number | number[]
} | {
    fileReadPath?: string,
    name: string,
    type: 'folder',
    children: FileMetaType[]
};

async function test() {
    const reader = new BundleReader('./output/out_1742658022425.bin');
    console.log(`[test] 是否被加密 ${reader.isCripto}`);
    
    const r1 = await reader.read('/a.txt');
    console.log(`[test] 读取 ${r1?.readSize} 字节`);
    
    if(r1?.dataType === 'Uint8Array'){
        fs.writeFileSync('./output/a.txt', r1.data); 
    }
    const r2 = await reader.read('/[授权·熟肉]最早的Minecraft服务器长什么样？15年后我找到了它.mp4'); 
    if(r2?.dataType === 'Uint8Array'){
        fs.writeFileSync('./output/1.mp4', r2.data); 
    }

    const r3 = await reader.read('/f1/28610724668.mp4'); 
    if(r3?.dataType === 'ReadableStream'){
        const reader = r3.data.getReader();
        fs.writeFileSync('./output/28610724668.mp4', '');
        while (1) {
            const {done, value} = await reader.read();
            if((value as Uint8Array)){
                fs.appendFileSync('./output/28610724668.mp4', value);
            }
            if(done){
                break; 
            }
            
        }
    }
}
// test(); 