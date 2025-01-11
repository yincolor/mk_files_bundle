/*
名称：制作简易的虚拟文件系统
功能：将源目录下的所有文件读取为字节流，追加入指定的二进制文件中，同时生成元数据
缺陷：不支持链接文件；因为只会追加，所以在执行前需要删除历史目标文件
*/
import { readdir } from "node:fs";
import path from "node:path";
import { appendFile } from "node:fs/promises";

/** 最终输出文件的文件名（或路径） @type {string} */
const vfiles_name = 'svfs.bin';
/** 最终输出文件的元数据 @type {string} */
const vfiles_metadata_name = 'svfs_metadata.json';
/** 源目录 */ 
const source_dir = '../www'; 

// 主函数 
(async function () {
    // 1 读取文件树
    let read_dir = path.resolve(import.meta.dir, source_dir); 
    console.log(`读取目录：${read_dir}`);
    /** 本地文件列表 @type {LocalFile[]} */
    const f_list = await getFiles(read_dir);
    
    // 2 依次读取文件， 追加入最终合并文件中，并记录元数据 （数据字节长度， 文件名， 路径， 文件blob类型）
    const vfiles_metadata = [];
    let cur_offset = 0; 
    for (const local_file of f_list) {
        const buffer = await local_file.read(); // 读取文件内容
        const v_path = local_file.file_path.slice(read_dir.length); //虚拟文件系统的路径 比如：/index.html
        vfiles_metadata.push({
            v_path: v_path,
            file_name: local_file.file_name,
            offset: cur_offset,
            byte_lenth: buffer.length,
            blob_type: local_file._bunfile.type
        });
        cur_offset += buffer.length; 
        appendByteStreamToFile(vfiles_name, buffer); 
    }

    // 3 将元数据也写入本地
    appendByteStreamToFile(vfiles_metadata_name, JSON.stringify(vfiles_metadata));
})();


/**
 * 映射本地文件系统里的文件的对象
 */
class LocalFile {
    constructor(file_name, root_dir) {
        this.file_name = file_name;
        this.directory = root_dir;
        this.file_path = path.resolve(this.directory, this.file_name);
        this._bunfile = Bun.file(this.file_path);
    }
    async read() {
        const stream = this._bunfile.stream();
        const reader = stream.getReader();
        /**
         * @type {Uint8Array[]}
         */
        const arr_list = [];
        let arr_len = 0;
        while (true) {
            const { value, done } = await reader.read();
            if (value) {
                arr_list.push(value);
                arr_len += value.length;
            }
            if (done) {
                break;
            }
        }
        let res = new Uint8Array(arr_len);
        let cur_index = 0;
        for (const u8arr of arr_list) {
            res.set(u8arr, cur_index);
            cur_index += u8arr.length;
        }
        return res;
    }

    async isFile() {
        return await this._bunfile.exists();
    }
    toObject() {
        const res = {};
        for (const param in this) {
            // console.log(param);
            res[param] = this[param];
        }
        return res;
    }
}

/** 获取全部文件 */
async function getFiles(root_dir) {
    return new Promise((resolve, reject) => {
        readdir(root_dir, async (err, files) => {
            if (err) {
                reject(null);
            }
            const f_list = []
            for (const f of files) {
                const lf = new LocalFile(f, root_dir);
                const isfile = await lf.isFile();
                // console.log(lf.file_path, isfile);

                if (isfile == false) {
                    const child_dir_f_list = await getFiles(lf.file_path);
                    if (child_dir_f_list) {
                        for (const cdf of child_dir_f_list) {
                            f_list.push(cdf);
                        }
                    }
                } else {
                    f_list.push(lf);
                }
            }
            resolve(f_list);
        });
    });
}

/**
 * 向最终输出文件后面追加字节流
 * @param {string} file_path 
 * @param {Uint8Array} stream  
 */
async function appendByteStreamToFile(file_path, stream) {
    await appendFile(file_path, stream); 
}

