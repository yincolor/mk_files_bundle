import { SimpleVirtualFileSystem } from "./M_svfs_bun.js";
const svfs = new SimpleVirtualFileSystem();
async function main() {
    const decoder = new TextDecoder();
    let val;
    let file_path_list = ['/index.html', '/project.js', '/d1/2.txt', '/d1/1.txt', '/d1/d3/4.txt', '/d1/d3/3.txt', '/style.css'];
    for (const file_path of file_path_list) {
        console.log(`================ ${file_path} ================`);
        val = await svfs.readByPath(file_path)
        if (val) {
            const str = decoder.decode(val);
            console.log(str);
        } else {
            console.log(val);
        }
    }

}
main(); 