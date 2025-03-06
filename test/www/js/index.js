

const p = document.createElement('p');
p.innerText = "你好世界";
document.body.appendChild(p);

const img_list = ['1.png', '2.png', '3.png', '4.png','567890.png','艺术字.png','英文字母_黑白.png'];

function appendImg() {

    for (const img_name of img_list) {
        const img = document.createElement('img');
        img.src = "img/"+img_name;
        document.body.appendChild(img); 
    }   
}