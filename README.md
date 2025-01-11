# simple-virtual-file-system-bun
基于Bun，打包一个目录，制作简易的虚拟文件系统的程序

1、打包目录：
在修改 mk_svfs.js 文件内开头的几个预定义的变量后，执行该js文件：
```
bun run mk_svfs.js
```
会生成两个文件，一个是存储数据的二进制文件，另一个是存储文件元数据的JSON文件。这两个文件的文件名由 mk_svfs.js 文件内预定义的变量决定。

2、使用：
M_svfs_bun.js 是一个ES模块。
首先应该修改 M_svfs_bun.js 文件内开头import的文件名，修改为生成的文件的文件名。
之后就可以直接引用该模块来使用了。
tes.js 是一个展示使用方法的测试文件。
