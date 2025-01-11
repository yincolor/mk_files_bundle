
import svfs_metadata from "./svfs_metadata.json" with {type: "json"};
import svfs_bin from "./svfs.bin" with {type: "file"};
import { BunFile } from "bun";

/**
 * 根据路径查找文件元数据
 * @param {string} file_path 
 */
function findFileMetadata(file_path) {
    for (let i = 0; i < svfs_metadata.length; i++) {
        const metadata = svfs_metadata[i]; 

        const v_path = metadata?.v_path;
        // console.log(v_path);
        
        if(v_path && v_path == file_path){
            return metadata; 
        }
    }
    return null; 
}


/**
 * 读取文件流，截取长度
 * @param {BunFile} file 
 * @param {number} start 起始
 * @param {number} len 长度
 */
async function readFileStream(file, start, len){
    const reader = file.stream().getReader(); 
    /**
     * @type {Uint8Array[]}
     */
    const arr_list = [];
    let arr_len = 0;
    while (true) {
        const { value, done } = await reader.read();
        if (value) {
            // 判断是否在截取范围里 
            const chunk_start_pos = arr_len;
            arr_len += value.length; 
            const chunk_end_pos = arr_len - 1 ;  
            // console.log(`(${start}, ${start+len-1}), (${chunk_start_pos}, ${chunk_end_pos})`);
            
            if(chunk_start_pos > (start + len - 1) || chunk_end_pos < start){
                // 没有进入截取范围或已经离开了 不做处理
                continue; 
            }else if(chunk_start_pos <= start && chunk_end_pos >= (start + len -1)){
                // 这个块覆盖了整个截取范围
                const slice_start_pos = start - chunk_start_pos;
                const res = value.slice(slice_start_pos, slice_start_pos + len); 
                arr_list.push(res);
                break; 
            }else if(chunk_start_pos >= start && chunk_end_pos <= (start + len -1)){
                // 这个块在截取范围中，只是一小块 直接push入临时列表中
                arr_list.push(value);
            }else if(chunk_start_pos < start && chunk_end_pos >= start ){
                // 这个块前面有一部分没有在截取范围中，但是后一部分进入了
                const slice_start_pos = start - chunk_start_pos;
                const res = value.slice(slice_start_pos); 
                arr_list.push(res);
            }else if(chunk_end_pos > (start + len -1) && chunk_start_pos <= (start + len -1)){
                // 这个块前面有一部分在截取范围中，但是后一部分离开了
                const slice_end_pos = chunk_end_pos - (start+len);
                const res = value.slice(0, slice_end_pos); 
                arr_list.push(res);
            }else{
                console.log('不可能的分支，前面的逻辑有问题');
            }
        }
        if (done) {
            break;
        }
    }
    let res = new Uint8Array(len); 
    let cur_index = 0;
    for (const u8arr of arr_list) {
        res.set(u8arr, cur_index);
        cur_index += u8arr.length;
    }
    return res;
}

/** 虚拟文件系统对象 */
export class SimpleVirtualFileSystem {
    constructor() {
        this._vfiles = Bun.file(svfs_bin);
        this._metadata = svfs_metadata;
    }

    /**
     * 根据虚拟文件系统的路径读取文件数据
     * @param {string} file_path 
     */
    async readByPath(file_path) {
        const f_metadata = findFileMetadata(file_path);
        // console.log(f_metadata);
        
        if(f_metadata){
            const start = f_metadata?.offset;
            const len = f_metadata?.byte_lenth;
            const buffer = await readFileStream(this._vfiles, start, len); 
            return buffer
        }else {
            return null; 
        }
    }
}