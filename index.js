const koa = require("koa");
const koaRouter = require("koa-router");
const formidable = require("formidable");
const fs = require("fs");
const path = require("path");
const unzip = require("unzip");
const crypto = require("crypto");
const {copy, rmdirsSync} = require("./util.js");
const parse = require("url").parse;

const app = new koa();
// const allowCORS = async (ctx, next) => {
//     // ctx.set("Access-Control-Allow-Origin", "120.78.221.14,localhost:8080");
//     ctx.set("Access-Control-Allow-Origin", "*");
//     ctx.set("Access-Control-Allow-Headers", "X-Requested-With,X-PINGOTHER,Content-Type,sessionid");
//     ctx.set("Access-Control-Allow-Methods","PUT,POST,GET,DELETE,OPTIONS");
//     await next();
// }
// app.use()
const router = new koaRouter({
    prefix: "/api"
});
let imageMimeReg = /^image\/.+/;
const stream2Buffer = stream => {  
    return new Promise((resolve, reject) => {
        let buffers = [];
        stream.on('error', reject);
        stream.on('data', (data) => buffers.push(data));
        stream.on('end', () => resolve(Buffer.concat(buffers)));
    });
}

router.post("/upload", ctx => {
    ctx.respond = false;

    //这里因为涉及到回调处理方式，所以绕过koa的内置响应方式
    let form = new formidable.IncomingForm();
    // form.uploadDir = path.resolve(__dirname, "./upload");
    form.keepExtensions = true;//保存扩展名
    let filePath = path.resolve(__dirname, "./upload/" + "server-dist.zip");
    let config = {
        type: "",//server、client、image
        name: "",//解压缩之后的文件名称
        project: "",//项目名称
        md5: "",//文件的md5值
    }
    //如果是上传图片，该图片的文件名（MD5值）
    let ext = "";
    form.parse(ctx.req);
    //加一层前置判断，对上传的图片进行去重控制
    form.onPart = async part => {
        if (!part.filename || !imageMimeReg.test(part.mime)) {
            form.handlePart(part);
        } else {
            //拿到扩展名
            ext = part.mime.split("/")[1];
            // form.resume();
            form.handlePart(part);
        }
    }
    form.on('field', function(field, value) {
        config[field] = value;
        console.log(field, value);
        
    }).on('fileBegin', function(name, file) {
        if (config.type === "image") {
            //代表上传图片
            console.log("上传图片");
            filePath = path.resolve(__dirname, `../${config.project}/upload/${config.md5}.${ext}`);
        } else {
            filePath = path.resolve(__dirname, `./upload/${config.project}-${config.type}-dist.zip`);
        }
        file.path = filePath;
    }).on("end", () => {
        //如果是图片，就不做后续解压缩处理
        if (config.type === "image") {
            ctx.res.writeHead(200, {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "X-Requested-With,X-PINGOTHER,Content-Type,sessionid",
                "Access-Control-Allow-Methods": "PUT,POST,GET,DELETE,OPTIONS",
                "content-type": "application/json;charset=utf8;"
            });
            ctx.res.end(JSON.stringify({
                returnCode: 1,
                message: "上传成功",
                data: [`/public/upload/${config.md5}.${ext}`]
            }));
            return;
        };
        //保存文件结束
        //解压缩
        let unzip_extract = unzip.Extract({path: path.resolve(__dirname, "./unzip")});
        //监听解压缩、传输数据结束
        unzip_extract.on('finish', () => {
            console.log("解压结束");
        }).on("error", err => {
            console.log("unzip出错：", err);
        });
        //创建可读文件流，传输数据
        fs.createReadStream(filePath)
        .pipe(unzip_extract)
        .on("close", () => {
            console.log("开始替换文件");
            let unzipDirPath = path.resolve(__dirname, `./unzip/${config.name}`);
            let arr = fs.readdirSync(unzipDirPath);
            arr.forEach(item => {
                let targetPath = path.resolve(__dirname, `../${config.project}/${item}`);
                //如果已存在该路径，进行删除操作
                if (fs.existsSync(targetPath)) {
                    // console.log("存在路径：", targetPath);
                    //如果是文件夹
                    if (fs.statSync(targetPath).isDirectory()) {
                        rmdirsSync(targetPath);
                    } else {
                        fs.unlinkSync(targetPath);
                    }
                    
                }
                let originPath = path.join(unzipDirPath, item);
                copy(originPath, targetPath);
            });
            //删除接收到的压缩包
            fs.unlinkSync(filePath);
            //删除解压后的文件
            rmdirsSync(unzipDirPath);
            ctx.res.writeHead(200, {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "X-Requested-With,X-PINGOTHER,Content-Type,sessionid",
                "Access-Control-Allow-Methods": "PUT,POST,GET,DELETE,OPTIONS",
                "content-type": "text/plain;charset=utf8;"
            });
            ctx.res.end("保存成功");
        });
    }).on("error", (err) => {
        ctx.res.writeHead(200, {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "X-Requested-With,X-PINGOTHER,Content-Type,sessionid",
            "Access-Control-Allow-Methods": "PUT,POST,GET,DELETE,OPTIONS",
            "content-type": "text/plain;charset=utf8;"
        });
        ctx.res.end("上传失败");
        console.log("出错：", err);
    });
    
});
app.use(router.routes()).use(router.allowedMethods());

app.listen(2235, "172.18.249.80", () => {
// app.listen(2235, "127.0.0.1", () => {
    console.log("run11222");
});