const THUMB_MAX=320,THUMB_QUALITY=0.75,VALID_YEAR_MIN=2003,VALID_YEAR_MAX=2050;

function parseExifDate(str){
  if(!str)return null;
  const d=new Date(str.replace(/^(\d{4}):(\d{2}):(\d{2})/,'$1-$2-$3'));
  return isNaN(d.getTime())?null:d;
}

function fmtBytes(b){
  if(b<1024)return b+' B';
  if(b<1048576)return (b/1024).toFixed(1)+' KB';
  return (b/1048576).toFixed(1)+' MB';
}

function getDateFromName(name){
  const m=name.match(/(19|20)\d{2}[_-]?([01]\d)[_-]?([0-3]\d)/);
  if(!m)return null;
  const d=new Date(+m[0].slice(0,4),+m[2]-1,+m[3]);
  return isNaN(d.getTime())?null:d;
}

function normalizeDate(date){
  if(!date)return null;
  const y=date.getFullYear();
  return y>=VALID_YEAR_MIN&&y<=VALID_YEAR_MAX?date:null;
}

async function buildPreview(file){
  let bitmap=null;
  try{
    bitmap=await createImageBitmap(file);
    const ratio=Math.min(THUMB_MAX/bitmap.width,THUMB_MAX/bitmap.height,1);
    const width=Math.max(1,Math.round(bitmap.width*ratio));
    const height=Math.max(1,Math.round(bitmap.height*ratio));
    const canvas=new OffscreenCanvas(width,height);
    const ctx=canvas.getContext('2d');
    ctx.drawImage(bitmap,0,0,width,height);
    return{
      width:bitmap.width,
      height:bitmap.height,
      thumbBlob:await canvas.convertToBlob({type:'image/jpeg',quality:THUMB_QUALITY})
    };
  }catch(error){
    return{width:null,height:null,thumbBlob:null};
  }finally{
    if(bitmap)bitmap.close();
  }
}

self.onmessage=async({data})=>{
  const{id,file}=data;
  const preview=await buildPreview(file);
  const inferredDate=normalizeDate(getDateFromName(file.name)||new Date(file.lastModified));
  self.postMessage({
    id,
    meta:{
      name:file.name,
      size:fmtBytes(file.size),
      date:inferredDate?inferredDate.toISOString():null,
      dateRaw:inferredDate?inferredDate.toLocaleString():null,
      make:null,
      model:null,
      lens:null,
      focalLength:null,
      aperture:null,
      shutter:null,
      iso:null,
      width:preview.width,
      height:preview.height,
      lat:null,
      lon:null,
      software:null,
      flash:null,
      whiteBalance:null,
    },
    thumbBlob:preview.thumbBlob
  });
};
