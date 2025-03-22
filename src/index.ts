// 项目名称 bbrp (bun binary resource package) 用于扫描文件夹，将其中的文件加密、打包为一个二进制文件

/*
使用方式：
bbrp -c <dir1> -o <dir2> -p <password_str> 将 dir1 目录整体打包为一个文件，使用 password_str 作为密钥进行加密，落地到 dir2 目录下，dir2 目录默认为命令执行的当前目录
bbrp -e <pack_file_path> -o <dir> -p <password_str> 将 pack_file_path 路径指向的打包文件，解包到 dir 目录下，如果是加密后的打包文件，需要提供 password_str 解密密钥

options 参数选项：
    -c create 等待打包的目录，将作为打包文件树的根节点
    -o output 输出打包文件的目录
    -e extract 解包的打包文件的文件路径
    -p password 加密-解密密钥（UTF-8编码）
*/

import { argsParse } from "./argv_parser.ts";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream";
import { mimeType } from "mime-type/with-db";
import { cryptoUtil, numberToUint8Array } from "./crypto.ts";

async function main() {
    const args = argsParse();
    // console.log(args);

    if (args.commandType === 'pack') {
        if (!checkDirExists(args.packDir, 'dir')) {
            throw new Error(`打包目录不存在，请检查：${args.packDir}`);
        }

        const {fileMetaList, fileTotalNum} = await getFileMeta(args.packDir);
        console.log(`当前文件总数：${fileTotalNum}`);

        const tempSaveAreaFilePath = path.resolve((args.outputDir || './'), 'tmp_'+ String((new Date()).getTime())); 
        fs.writeFileSync(tempSaveAreaFilePath, "", {encoding:'ascii'});  // 清空文件
        console.log(`清空文件 ${tempSaveAreaFilePath}`);
        const r1 = await appendFileMetaDataToOutFile(fileMetaList, tempSaveAreaFilePath, args.isCrypto, args.password||null); 
        console.log(`完成文件输出 ${tempSaveAreaFilePath}`); 
        console.log(`元数据生成...`);
        const saveFilesMeta = {
            pwd: args.password, 
            tree: r1.fileMetaList
        }
        const metaStr = JSON.stringify(saveFilesMeta); 
        console.log(metaStr);
        const encoder = new TextEncoder();
        const metaBase64Data = encoder.encode(cryptoUtil.base64.encode(metaStr)); // BASE64编码
        const xorEncryptByte = Math.ceil(Math.random()*255); 
        const metaBase64XORData = cryptoUtil.xor(metaBase64Data, xorEncryptByte); // XOR加密
        const metaBase64XORDataLength = metaBase64XORData.byteLength; 
        if(metaBase64XORDataLength > (2**32)){
            throw new Error(`元数据数据长度超过32位 ${metaBase64XORDataLength}`);
        }
        const metaSizeData =  numberToUint8Array(metaBase64XORDataLength, 4); //new Uint8Array([(metaBase64XORDataLength&0xFF), (metaBase64XORDataLength>>>8 & 0xFF) , (metaBase64XORDataLength>>>16 & 0xFF) , (metaBase64XORDataLength>>>24 & 0xFF)]); 
        const saveFilePath = path.resolve((args.outputDir || './'), 'out_'+ String((new Date()).getTime()) +'.bin');  // 最终生成的文件
        fs.writeFileSync(saveFilePath, ""); 
        fs.appendFileSync(saveFilePath, encoder.encode('.PAK'));
        fs.appendFileSync(saveFilePath, new Uint8Array([xorEncryptByte]));
        fs.appendFileSync(saveFilePath, new Uint8Array([0x01])); 
        fs.appendFileSync(saveFilePath, metaSizeData); 
        fs.appendFileSync(saveFilePath, metaBase64XORData); 

        fs.writeFileSync(saveFilePath+'.json', metaStr); 
        fs.writeFileSync(saveFilePath+'.json.base64', metaBase64Data);

        await appendFileStreamToFile(tempSaveAreaFilePath, saveFilePath ); 
    } else {
    }
} main();

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

async function getFileMeta(dirPath: string) {
    const fileNameList = fs.readdirSync(dirPath, { recursive: false, encoding: 'utf-8' });
    const fileMetaList: FileMetaType[] = [];
    let fileTotalNum = 0;
    for (const fileName of fileNameList) {
        const fileReadPath = path.resolve(dirPath, fileName);
        const stats = fs.statSync(fileReadPath);
        if (stats.isDirectory()) {
            const nextDir = fileReadPath;
            const fileMeta = await getFileMeta(nextDir);
            fileMetaList.push({ fileReadPath, name: fileName, type: 'folder', children: fileMeta.fileMetaList });
            fileTotalNum += fileMeta.fileTotalNum;
        } else if (stats.isFile()) {
            const size = stats.size;
            let _mimeType = mimeType.contentType(path.basename(fileReadPath));
            if (_mimeType === true || _mimeType === false || _mimeType === (void 0)) {
                _mimeType = 'application/octet-stream';
            }
            fileMetaList.push({ fileReadPath, name: fileName, realSize: size, type: 'file', mimeType: _mimeType, saveIndex: -2147483648, saveSize: -2147483648 });
            fileTotalNum++;
        } else {
            console.log(`无法识别的文件类型 ${fileReadPath}`);
        }
    }
    fileMetaList.sort((a, b) => {
        if (a.type === 'file' && b.type === 'folder') {
            return -1;
        } else if (a.type === 'folder' && b.type === 'file') {
            return 1;
        } else if (a.type === 'file' && b.type === 'file') {
            return a.realSize - b.realSize;
        } else {
            return -1;
        }
    });
    return { fileMetaList, fileTotalNum };
}
/** 判断目录是否存在，如果类型是 dir 则checkPath 为目录的路径，如果类型是 file，则checkPath是文件的路径，需要取这个文件的归属目录的路径再判断  */
function checkDirExists(checkPath: string, type: 'dir' | 'file') {
    let _dir = checkPath;
    if (type === 'file') {
        _dir = path.dirname(checkPath);
    }
    const state = fs.statSync(_dir);
    return state.isDirectory();
}
/** 将 文件元数据列表中文件处理并输出到本地文件中 */
async function appendFileMetaDataToOutFile(fileMetaList: FileMetaType[], outFilePath: string, isCrypto: boolean, password: string|null, saveAreaEndIndex = 0) {
    let curSaveAreaEndIndex = saveAreaEndIndex; // 暂存当前存储区的尾部索引，作为下一个文件的开始索引
    const newFileMetaList: FileMetaType[] = [];
    let cryptoKey:CryptoKey|null = null; 
    let cryptoIV:Uint8Array|null = null; 
    if (isCrypto && password) {
        const { key, iv } = await cryptoUtil.aes.generateKey(password);
        cryptoKey = key; cryptoIV = iv; 
    }
    for (const fileMeta of fileMetaList) {
        if (!fileMeta.fileReadPath) {
            throw new Error(`无法读取的路径：${fileMeta.fileReadPath}`);
        }
        if (fileMeta.type === 'file') {
            const readFile = Bun.file(fileMeta.fileReadPath);
            const newFileMeta:FileMetaType = {name: fileMeta.name, realSize:fileMeta.realSize, type:'file', mimeType: fileMeta.mimeType, saveIndex: -1, saveSize: -1}; 
            /** 分段字节长度 */
            const segmentSize = 104857600;
            if (fileMeta.realSize <= segmentSize) {
                // 小于100Mb的，直接读取到内存
                const data = await readFile.bytes();
                let outData = data;
                if (isCrypto && password && cryptoKey != null && cryptoIV != null) {
                    outData = await cryptoUtil.aes.encrypt(data, cryptoKey, cryptoIV);
                }
                newFileMeta.saveSize = outData.byteLength;
                newFileMeta.saveIndex = curSaveAreaEndIndex;
                curSaveAreaEndIndex += newFileMeta.saveSize;
                fs.appendFileSync(outFilePath, outData);
            } else {
                // 大于100MB的，分段（100MB）读取文件，处理后追加
                const stepLength = Math.ceil((readFile.size) / segmentSize);
                newFileMeta.saveSize = [];
                newFileMeta.saveIndex = [];
                for (let i = 0; i < stepLength; i++) {
                    const sliceBunFile = readFile.slice(i * segmentSize, i * segmentSize + segmentSize, 'application/octet-stream');
                    const data = await sliceBunFile.bytes();
                    let outData = data;
                    if (isCrypto && password && cryptoKey != null && cryptoIV != null) {
                        outData = await cryptoUtil.aes.encrypt(data, cryptoKey, cryptoIV);
                    }
                    newFileMeta.saveSize[i] = outData.byteLength;
                    newFileMeta.saveIndex[i] = curSaveAreaEndIndex;
                    curSaveAreaEndIndex += newFileMeta.saveSize[i];
                    fs.appendFileSync(outFilePath, outData);
                }
            }
            const randomBytes = cryptoUtil.random.byteArray(Math.ceil(Math.random() * 16));
            fs.appendFileSync(outFilePath, randomBytes);
            curSaveAreaEndIndex += randomBytes.byteLength;
            newFileMetaList.push(newFileMeta); 
        } else if (fileMeta.type === 'folder') {
            const newFileMeta:FileMetaType = {name: fileMeta.name, type:'folder', children: []}; 
            const childFileMetaList = fileMeta.children; 
            const nextLevel = await appendFileMetaDataToOutFile(childFileMetaList, outFilePath, isCrypto, password, curSaveAreaEndIndex); 
            // console.log(fileMeta.fileReadPath,'是目录');
            curSaveAreaEndIndex = nextLevel.saveAreaEndIndex; 
            newFileMeta.children = nextLevel.fileMetaList; 
            // console.log(newFileMeta);
            newFileMetaList.push(newFileMeta); 
        }
    }
    return { saveAreaEndIndex: curSaveAreaEndIndex, fileMetaList: newFileMetaList }
}

async function appendFileStreamToFile(fromFilePath:string, toFilePath:string) {
    // 创建可读流（文件A）
    const readStream = fs.createReadStream(fromFilePath);
    
    // 创建可写流（文件B，以追加模式打开）
    const writeStream = fs.createWriteStream(toFilePath, {
      flags: 'a' // 'a' 表示追加模式
    });
   
    // 使用 pipeline 管理流
    return new Promise((resolve, reject)=>{
        // readStream.on('data', (chunk)=>{
        //     console.log(readStream.bytesRead);
        // }); 
        pipeline(readStream, writeStream, (err)=>{
            if(err){
                console.log(err.message);
                resolve(false);
            }else{
                console.log('追加成功');
                resolve(true);
            }
        })
    })
  }
   


// |--4字节 .PAK--|--1字节 存储元数据的异或加密的密钥--|--1字节 0x00 未编码明文 0x01 base64编码之后再加密的--|--4字节 元数据长度--|--存储加密之后的元数据--|--存储区，存储各个文件，一般为加密后的，同时每个文件之间插入随机数量的混乱字节数组用于混淆--|
// 举例：元数据
const __example_meta = {
    password: 'asdasdasdq1213', // 区块加密、解密密钥，当然可以为空字符串，如果为空字符串，可能是没有加密，但是也可能是不提供密钥。在读取模块时提供
    fileTree: [
        {
            name: '文件1.txt', // 文件名，代表 /文件1.txt
            realSize: 102411, // 文件读取时的原始字节长度
            packSize: 102415628, // 文件打包进存储区体积（单位（字节）Byte），如果是经过AES CBC 256加密后的，则必定为16字节的倍数，所以会比原始长度要长
            startIndex: 0, // 文件在存储区的开始位置
            type: 'file',  // 节点类型，如果为“file”节点是文件，如果是“folder”节点是文件夹，下面可能有文件
            mimeType: 'text/plain' // 如果是文件，则提供文件的 MIME 类型，默认为：application/octet-stream 即字节数据流
        },
        {
            name: '文件2.log',
            realSize: 102411,
            packSize: 1081,
            startIndex: 12123112,
            type: 'file',
            mimeType: 'text/plain'
        },
        {
            name: 'mod2.png',
            realSize: 12000,
            packSize: 12000,
            startIndex: 1,
            type: 'file',
            mimeType: 'image/png',
        },
        {
            name: '这是一个文件夹',
            type: 'folder',
            children: [
                {
                    name: "文件3.mp3",
                    realSize: 123,
                    packSize: 128,
                    chunckID: 0,
                    chunckIndex: 2,
                    type: 'file',
                    mimeType: 'audio/mp3'
                }
            ]
        }
    ]
}