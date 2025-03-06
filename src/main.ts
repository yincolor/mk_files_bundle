import fs from "node:fs";
import path from "node:path";
import { mimeType } from 'mime-type/with-db';
import { appendFileBufferToFile, createEmptyFile } from "./file_tools";
import { base64Encode, numberToUint8Array, uint8ArrayToNumber, simpleEncryption } from "./crypto";

// command -i 【目录路径】 
async function main() {
    console.log(process.argv);
    const param = getCommandParam(process.argv);
    if (param == null) {
        console.log('无效的命令行参数');
        return;
    }

    const fileMetaList = await getFileMeta(param.inputDir);
    console.log(fileMetaList);
    // 创建二进制文件
    createEmptyFile(param.outFilePath);
    // 数据追加到文件中
    const virtualFileMetaList: VirtualFileMeta[] = [];
    for (let i = 0; i < fileMetaList.length; i++) {
        const fileMeta = fileMetaList[i];
        virtualFileMetaList[i] = { path: fileMeta.virtualPath, offset: fileMeta.virtualOffset, size: fileMeta.size, contentType: fileMeta.contentType };
        const isOk = await appendFileBufferToFile(fileMeta.fileReadPath, fileMeta.size, param.outFilePath, (data) => {
            if (param.key) {
                // 使用设置的0-256的加密密钥进行加密
                const new_array = simpleEncryption(Uint8Array.from(data), param.key); 
                return Buffer.from(new_array); 
            } else {
                return data;
            }
        });
        if (isOk == false) {
            console.log('生成打包文件失败，请检查。');
            return;
        }
    }
    // 追加打包文件元数据
    const virtualMeta = {
        data: virtualFileMetaList,
        key: param.key
    }
    const virtualMetaBase64Data = base64Encode(JSON.stringify(virtualMeta));
    fs.appendFileSync(param.outFilePath, virtualMetaBase64Data);
    // 追加打包文件元数据长度信息
    const virtualMetaDataLength = virtualMetaBase64Data.length;
    console.log(`文件元数据长度: ${virtualMetaDataLength}`);
    console.log(numberToUint8Array(virtualMetaDataLength, 8));
    console.log(uint8ArrayToNumber(numberToUint8Array(virtualMetaDataLength, 8)));

    fs.appendFileSync(param.outFilePath, numberToUint8Array(virtualMetaDataLength, 8));
} main();

/** 文件元数据 */
type FileMeta = { fileReadPath: string, virtualPath: string, virtualOffset: number, size: number, contentType: string };
/** 虚拟文件元数据 */
type VirtualFileMeta = { path: string, offset: number, size: number, contentType: string };
/**
 * 获取目录下所有文件的元数据
 */
async function getFileMeta(dirPath: string, _virtualPath = '/', _isRoot = true) {
    const fileNameList = fs.readdirSync(dirPath, { recursive: false, encoding: 'utf-8' });
    const fileMetaList: FileMeta[] = [];
    for (const fileName of fileNameList) {
        const fileReadPath = path.resolve(dirPath, fileName);
        const stats = fs.statSync(fileReadPath);
        if (stats.isDirectory()) {
            const nextDir = fileReadPath;
            const nextFileMetaList = await getFileMeta(nextDir, _virtualPath + fileName + '/', false);
            for (const meta of nextFileMetaList) {
                fileMetaList.push(meta);
            }
        } else if (stats.isFile()) {
            const size = stats.size;
            const virtualPath = _virtualPath + fileName;
            let contentType = mimeType.contentType(path.basename(fileReadPath));
            if (contentType === true || contentType === false || contentType === (void 0)) {
                contentType = 'application/octet-stream';
            }
            fileMetaList.push({ fileReadPath, virtualPath, virtualOffset: 0, size, contentType });
        } else {
            console.log('无法识别的文件类型，跳过。');
        }
    }
    if (_isRoot) {
        fileMetaList.sort((a, b) => { return a.size - b.size; });
        const _fileNum = fileMetaList.length;
        let _offset = 0;
        for (let i = 0; i < _fileNum; i++) {
            fileMetaList[i].virtualOffset = _offset;
            _offset += fileMetaList[i].size;
        }
    }
    return fileMetaList;
}

/** 获取参数 */
function getCommandParam(args: string[]) {
    let inputDir = null;
    let outFilePath: string | null = './out.bin';
    let key: number | null = null;
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-i') {
            inputDir = (i + 1) >= args.length ? null : args[i + 1];
            continue;
        }
        if (args[i] === '-o') {
            outFilePath = (i + 1) >= args.length ? null : args[i + 1];
            continue;
        }
        if (args[i] === '-key') {
            const _k = (i + 1) >= args.length ? null : args[i + 1];
            if (_k === null || isNaN(Number(_k))) {
                continue;
            } else {
                key = Number(_k);
                continue;
            }
        }
    }
    if (inputDir && outFilePath) {
        return { inputDir, outFilePath, key }
    } else {
        return null;
    }
}

/*

0、本脚本目的是获取一个目录下的所有文件，打包为单独的字节文件
1、先遍历目录下文件，获取每个文件的路径、字节长度、文件类型等元数据的列表(fileMetaList)，按文件字节长度从小到大排序。
2、创建输出文件(resource.bin)，并清空内容
3、遍历元数据列表，读取对应的文件的字节流，然后依次追加到输出文件，同时将偏移量参数附加到元数据中
    当文件小于100MB，直接读取并追加到输出文件中。
    当文件大于100MB，以100MB为步长，分块读取，然后追加到输出文件中。

*/