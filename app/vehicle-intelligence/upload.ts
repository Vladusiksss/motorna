import {verifyDocument,UploadError} from '../document-upload';
export function verifyPhoto(bytes:ArrayBuffer,mime:string){
 if(!['image/jpeg','image/png'].includes(mime))throw new UploadError('Додайте JPG або PNG до 5 МБ.');
 verifyDocument(bytes,mime);const b=new Uint8Array(bytes),view=new DataView(bytes);let w=0,h=0;
 if(mime==='image/png'){w=view.getUint32(16);h=view.getUint32(20);}
 else{let i=2;while(i+4<=b.length){if(b[i++]!==255)break;const marker=b[i++];if(marker===0xda||marker===0xd9)break;const size=view.getUint16(i);if(size<2||i+size>b.length)break;if([0xc0,0xc1,0xc2].includes(marker)&&size>=8){h=view.getUint16(i+3);w=view.getUint16(i+5);break;}i+=size;}}
 if(!w||!h||w>12000||h>12000||w*h>40000000)throw new UploadError('Некоректне або завелике зображення (до 40 Мп).');
}
