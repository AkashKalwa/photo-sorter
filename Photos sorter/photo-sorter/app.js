'use strict';
class LRUCache{
  constructor(n){this.max=n||60;this.map=new Map();}
  get(k){if(!this.map.has(k))return null;const v=this.map.get(k);this.map.delete(k);this.map.set(k,v);return v;}
  set(k,v){
    if(this.map.has(k))this.map.delete(k);
    else if(this.map.size>=this.max){const o=this.map.keys().next().value;const ov=this.map.get(o);if(typeof ov==='string'&&ov.startsWith('blob:'))URL.revokeObjectURL(ov);this.map.delete(o);}
    this.map.set(k,v);
  }
  has(k){return this.map.has(k);}
}
function formatFileSize(b){
  if(b<1024)return b+' B';
  if(b<1048576)return (b/1024).toFixed(1)+' KB';
  return (b/1048576).toFixed(1)+' MB';
}
function parseExifDateString(value){
  if(!value||typeof value!=='string')return null;
  const parsed=new Date(value.replace(/^(\d{4}):(\d{2}):(\d{2})/,'$1-$2-$3'));
  if(isNaN(parsed.getTime()))return null;
  return isValidYear(parsed.getFullYear())?parsed:null;
}
function formatExifDateString(value){
  const parsed=parseExifDateString(value);
  return parsed?parsed.toLocaleString():null;
}
function toGpsDecimal(value,ref){
  if(value==null)return null;
  const parts=Array.isArray(value)?value:[value];
  const nums=parts.map(part=>{
    if(typeof part==='number')return part;
    if(part&&typeof part.numerator==='number'&&typeof part.denominator==='number'&&part.denominator!==0){
      return part.numerator/part.denominator;
    }
    return Number(part)||0;
  });
  const decimal=(nums[0]||0)+((nums[1]||0)/60)+((nums[2]||0)/3600);
  const sign=ref==='S'||ref==='W'?-1:1;
  return (decimal*sign).toFixed(6);
}
function formatExposureTime(value){
  if(typeof value!=='number'||!isFinite(value)||value<=0)return null;
  return value>=1?value+'s':'1/'+Math.round(1/value)+'s';
}
function formatExifValue(value,suffix){
  if(value==null||value==='')return null;
  return suffix?value+suffix:String(value);
}
function inferDate(file){
  const source=[file.webkitRelativePath||'',file.name].join(' ');
  const match=source.match(/(19|20)\d{2}[_-]?([01]\d)[_-]?([0-3]\d)/);
  let date=null;
  if(match)date=new Date(+match[0].slice(0,4),+match[2]-1,+match[3]);
  if(!date||isNaN(date.getTime()))return null;
  return isValidYear(date.getFullYear())?date:null;
}
function readExifDate(file){
  return new Promise(resolve=>{
    if(typeof EXIF==='undefined'||!EXIF.getData){resolve(null);return;}
    try{
      EXIF.getData(file,function(){
        const raw=EXIF.getTag(this,'DateTimeOriginal')||EXIF.getTag(this,'DateTimeDigitized')||EXIF.getTag(this,'DateTime');
      resolve(parseExifDateString(raw));
      });
    }catch(error){
      resolve(null);
    }
  });
}
function readExifDetails(file){
  return new Promise(resolve=>{
    if(typeof EXIF==='undefined'||!EXIF.getData){resolve({});return;}
    try{
      EXIF.getData(file,function(){
        const rawDate=EXIF.getTag(this,'DateTimeOriginal')||EXIF.getTag(this,'DateTimeDigitized')||EXIF.getTag(this,'DateTime')||null;
        const lat=toGpsDecimal(EXIF.getTag(this,'GPSLatitude'),EXIF.getTag(this,'GPSLatitudeRef'));
        const lon=toGpsDecimal(EXIF.getTag(this,'GPSLongitude'),EXIF.getTag(this,'GPSLongitudeRef'));
        resolve({
          date:parseExifDateString(rawDate)?.toISOString()||null,
          dateRaw:formatExifDateString(rawDate),
          make:EXIF.getTag(this,'Make')||null,
          model:EXIF.getTag(this,'Model')||null,
          lens:EXIF.getTag(this,'LensModel')||null,
          focalLength:formatExifValue(EXIF.getTag(this,'FocalLength'),'mm'),
          aperture:EXIF.getTag(this,'FNumber')!=null?'f/'+EXIF.getTag(this,'FNumber'):null,
          shutter:formatExposureTime(EXIF.getTag(this,'ExposureTime')),
          iso:EXIF.getTag(this,'ISOSpeedRatings')||EXIF.getTag(this,'ISO')||null,
          width:EXIF.getTag(this,'PixelXDimension')||EXIF.getTag(this,'ExifImageWidth')||null,
          height:EXIF.getTag(this,'PixelYDimension')||EXIF.getTag(this,'ExifImageHeight')||null,
          lat,
          lon,
          software:EXIF.getTag(this,'Software')||null,
          flash:EXIF.getTag(this,'Flash')!=null?String(EXIF.getTag(this,'Flash')):null,
          whiteBalance:EXIF.getTag(this,'WhiteBalance')!=null?(EXIF.getTag(this,'WhiteBalance')===0?'Auto':'Manual'):null
        });
      });
    }catch(error){
      resolve({});
    }
  });
}
async function buildBaseMeta(file){
  const exifDate=await readExifDate(file);
  const date=exifDate||inferDate(file);
  return{
    name:file.name,
    size:formatFileSize(file.size),
    date:date?date.toISOString():null,
    dateRaw:date?date.toLocaleString():null,
    make:null,
    model:null,
    lens:null,
    focalLength:null,
    aperture:null,
    shutter:null,
    iso:null,
    width:null,
    height:null,
    lat:null,
    lon:null,
    software:null,
    flash:null,
    whiteBalance:null,
    exifLoaded:false,
    exifLoading:false
  };
}
const thumbCache=new LRUCache(60);
let allPhotos=[],flatIndex=[],currentLbIdx=-1;
const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
const VALID_YEAR_MIN=2003,VALID_YEAR_MAX=new Date().getFullYear();
function isValidYear(y){return y>=VALID_YEAR_MIN&&y<=VALID_YEAR_MAX;}
const fileInput=document.getElementById('file-input');
const folderInput=document.getElementById('folder-input');
const uploadArea=document.getElementById('upload-area');
const gallery=document.getElementById('gallery');
const stats=document.getElementById('stats');
const filterBar=document.getElementById('filter-bar');
const filterYear=document.getElementById('filter-year');
const filterMonth=document.getElementById('filter-month');
const filterClear=document.getElementById('filter-clear');
const lightbox=document.getElementById('lightbox');
const lbImg=document.getElementById('lb-img');
const lbName=document.getElementById('lb-name');
const lbMeta=document.getElementById('lb-meta');
const lbClose=document.getElementById('lb-close');
const lbPrev=document.getElementById('lb-prev');
const lbNext=document.getElementById('lb-next');
const io=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(!e.isIntersecting)return;loadThumb(e.target,parseInt(e.target.dataset.idx,10));io.unobserve(e.target);});
},{rootMargin:'300px'});
async function loadThumb(el,sourceIdx){
  const img=el.querySelector('img');if(!img)return;
  let src=thumbCache.get(sourceIdx);
  if(src){img.src=src;img.onload=()=>img.classList.add('loaded');return;}
  const file=allPhotos[sourceIdx].file;
  const cached=await getThumb(file);
  if(cached){src=URL.createObjectURL(cached);thumbCache.set(sourceIdx,src);img.src=src;img.onload=()=>img.classList.add('loaded');return;}
  src=URL.createObjectURL(file);
  thumbCache.set(sourceIdx,src);
  img.src=src;
  img.onload=()=>img.classList.add('loaded');
}
function groupPhotos(photos){
  const byYear={},unknown=[];
  photos.forEach((p,i)=>{
    p.viewIdx=i;
    const d=p.meta.date?new Date(p.meta.date):null,y=d?d.getFullYear():null;
    if(d&&isValidYear(y)){const m=d.getMonth();if(!byYear[y])byYear[y]={};if(!byYear[y][m])byYear[y][m]=[];byYear[y][m].push(p);}
    else unknown.push(p);
  });
  Object.keys(byYear).forEach(year=>{
    Object.keys(byYear[year]).forEach(month=>{
      byYear[year][month].sort(comparePhotosNewestFirst);
    });
  });
  unknown.sort(comparePhotosNewestFirst);
  return{byYear,unknown};
}
function populateFilters(photos){
  const years=new Set(),months=new Set();let hasUnknown=false;
  photos.forEach(p=>{const d=p.meta.date?new Date(p.meta.date):null,y=d?d.getFullYear():null;if(d&&isValidYear(y)){years.add(y);months.add(d.getMonth());}else hasUnknown=true;});
  filterYear.innerHTML='<option value="">All years</option>';
  filterMonth.innerHTML='<option value="">All months</option>';
  [...years].sort((a,b)=>b-a).forEach(y=>filterYear.innerHTML+='<option value="'+y+'">'+y+'</option>');
  [...months].sort((a,b)=>a-b).forEach(m=>filterMonth.innerHTML+='<option value="'+m+'">'+MONTHS[m]+'</option>');
  if(hasUnknown)filterYear.innerHTML+='<option value="unknown">Unknown</option>';
  filterBar.classList.remove('hidden');
}
function comparePhotosNewestFirst(a,b){
  const aTime=a.meta.date?new Date(a.meta.date).getTime():-Infinity;
  const bTime=b.meta.date?new Date(b.meta.date).getTime():-Infinity;
  return bTime-aTime||a.meta.name.localeCompare(b.meta.name);
}
function getFilteredPhotos(){
  const yVal=filterYear.value,m=filterMonth.value!==''?parseInt(filterMonth.value,10):null;
  if(yVal===''&&m===null)return [...allPhotos].sort(comparePhotosNewestFirst);
  if(yVal==='unknown')return allPhotos.filter(p=>{const y=p.meta.date?new Date(p.meta.date).getFullYear():null;return!p.meta.date||!isValidYear(y);}).sort(comparePhotosNewestFirst);
  const y=yVal?parseInt(yVal,10):null;
  return allPhotos.filter(p=>{
    if(!p.meta.date)return false;
    const d=new Date(p.meta.date),py=d.getFullYear();
    if(!isValidYear(py))return false;
    if(y!==null&&py!==y)return false;
    if(m!==null&&d.getMonth()!==m)return false;
    return true;
  }).sort(comparePhotosNewestFirst);
}
function renderGallery(photos){
  gallery.innerHTML='';flatIndex=photos;
  if(!photos.length){gallery.innerHTML='<p id="no-results">No photos match the selected filter.</p>';return;}
  const{byYear,unknown}=groupPhotos(photos);
  Object.keys(byYear).map(Number).sort((a,b)=>b-a).forEach(year=>{
    const sec=document.createElement('section');sec.className='year-section';
    sec.innerHTML='<h2 class="year-title">'+year+'</h2>';
    Object.keys(byYear[year]).map(Number).sort((a,b)=>b-a).forEach(month=>{
      const ms=document.createElement('div');ms.className='month-section';
      ms.innerHTML='<div class="month-title">'+MONTHS[month]+'</div>';
      ms.appendChild(buildGrid(byYear[year][month]));sec.appendChild(ms);
    });
    gallery.appendChild(sec);
  });
  if(unknown.length){
    const sec=document.createElement('section');sec.className='year-section';
    sec.innerHTML='<h2 class="year-title" style="color:var(--text-muted)">Unknown Date</h2>';
    sec.appendChild(buildGrid(unknown));gallery.appendChild(sec);
  }
}
function buildGrid(photos){
  const grid=document.createElement('div');grid.className='photo-grid';
  photos.forEach(p=>{
    const t=document.createElement('div');t.className='photo-thumb';t.dataset.idx=p.sourceIdx;
    t.innerHTML='<div class="placeholder"></div><img alt="'+p.meta.name+'" />';
    t.addEventListener('click',()=>openLightbox(p.viewIdx));
    grid.appendChild(t);io.observe(t);
  });
  return grid;
}
function openLightbox(idx){
  currentLbIdx=idx;const p=flatIndex[idx];
  lightbox.classList.remove('hidden');lbImg.src='';lbName.textContent=p.meta.name;
  lbImg.alt=p.meta.name;
  const url=URL.createObjectURL(p.file);lbImg.onload=()=>URL.revokeObjectURL(url);lbImg.src=url;
  renderMeta(p.meta);updateNavButtons();
  ensurePhotoMeta(p);
}
function renderMeta(meta){
  const d=meta.date?new Date(meta.date):null;
  const rows=[
    ['File name',meta.name],['File size',meta.size],
    ['Date & time',meta.dateRaw||(d?d.toLocaleString():null)],
    ['Dimensions',meta.width&&meta.height?meta.width+' x '+meta.height:null],
    ['Camera',[meta.make,meta.model].filter(Boolean).join(' ')||null],
    ['Lens',meta.lens],['Focal length',meta.focalLength],['Aperture',meta.aperture],
    ['Shutter',meta.shutter],['ISO',meta.iso],['Flash',meta.flash],
    ['White balance',meta.whiteBalance],
    ['GPS',meta.lat&&meta.lon?meta.lat+', '+meta.lon:null],
    ['Software',meta.software],
  ];
  let html=rows.filter(r=>r[1]!=null).map(r=>'<div class="meta-row"><span class="meta-label">'+r[0]+'</span><span class="meta-value">'+r[1]+'</span></div>').join('');
  if(meta.exifLoading&&!html)html='<div class="meta-row"><span class="meta-label">Details</span><span class="meta-value">Loading photo information...</span></div>';
  if(!html)html='<div class="meta-row"><span class="meta-label">Details</span><span class="meta-value">No embedded metadata found for this photo.</span></div>';
  if(meta.lat&&meta.lon)html+='<div class="meta-row"><span class="meta-label">Map</span><span class="meta-value"><a href="https://www.google.com/maps?q='+meta.lat+','+meta.lon+'" target="_blank" rel="noopener" style="color:var(--accent)">Open in Google Maps</a></span></div>';
  lbMeta.innerHTML=html;
}
async function ensurePhotoMeta(photo){
  if(photo.meta.exifLoaded||photo.meta.exifLoading)return;
  photo.meta.exifLoading=true;
  if(flatIndex[currentLbIdx]===photo)renderMeta(photo.meta);
  const details=await readExifDetails(photo.file);
  photo.meta=Object.assign({},photo.meta,details,{
    date:details.date||photo.meta.date,
    dateRaw:details.dateRaw||photo.meta.dateRaw,
    exifLoaded:true,
    exifLoading:false
  });
  setMeta(photo.file,photo.meta);
  if(flatIndex[currentLbIdx]===photo){
    lbName.textContent=photo.meta.name;
    renderMeta(photo.meta);
  }
}
function updateNavButtons(){
  lbPrev.style.opacity=currentLbIdx>0?'1':'0.2';
  lbNext.style.opacity=currentLbIdx<flatIndex.length-1?'1':'0.2';
}
function closeLightbox(){lightbox.classList.add('hidden');lbImg.src='';}
lbClose.addEventListener('click',closeLightbox);
lbPrev.addEventListener('click',()=>{if(currentLbIdx>0)openLightbox(currentLbIdx-1);});
lbNext.addEventListener('click',()=>{if(currentLbIdx<flatIndex.length-1)openLightbox(currentLbIdx+1);});
document.addEventListener('keydown',e=>{
  if(lightbox.classList.contains('hidden'))return;
  if(e.key==='Escape')closeLightbox();
  if(e.key==='ArrowLeft')lbPrev.click();
  if(e.key==='ArrowRight')lbNext.click();
});
lightbox.addEventListener('click',e=>{if(e.target===lightbox)closeLightbox();});
filterYear.addEventListener('change',applyFilter);
filterMonth.addEventListener('change',applyFilter);
filterClear.addEventListener('click',()=>{filterYear.value='';filterMonth.value='';applyFilter();});
function applyFilter(){renderGallery(getFilteredPhotos());}
async function processFiles(files){
  if(!files.length)return;
  allPhotos=[];flatIndex=[];currentLbIdx=-1;gallery.innerHTML='';filterBar.classList.add('hidden');stats.classList.remove('hidden');
  let pb=document.getElementById('progress-bar');
  if(!pb){pb=document.createElement('div');pb.id='progress-bar';stats.appendChild(pb);}
  pb.style.width='0%';
  const total=files.length;
  while(stats.firstChild&&stats.firstChild!==pb)stats.removeChild(stats.firstChild);
  const st=document.createTextNode('Preparing 0 / '+total+' photos...');
  stats.insertBefore(st,pb);
  const photos=new Array(total);
  let done=0;
  await Promise.all(Array.from(files).map(async(file,idx)=>{
    const cached=await getMeta(file);
    const baseMeta=await buildBaseMeta(file);
    const meta=Object.assign({},baseMeta,cached||{},{
      name:file.name,
      size:formatFileSize(file.size),
      date:baseMeta.date,
      dateRaw:baseMeta.dateRaw
    });
    photos[idx]={file,meta,thumbBlob:null,sourceIdx:idx};
    done++;
    st.textContent='Preparing '+done+' / '+total+' photos...';
    pb.style.width=((done/total)*100)+'%';
    setMeta(file,meta);
  }));
  allPhotos=photos;pb.style.width='100%';
  st.textContent=total+' photos loaded';
  populateFilters(allPhotos);renderGallery(allPhotos);
}
fileInput.addEventListener('change',e=>{processFiles(Array.from(e.target.files).filter(f=>f.type.startsWith('image/')));});
folderInput.addEventListener('change',e=>{processFiles(Array.from(e.target.files).filter(f=>f.type.startsWith('image/')));});
uploadArea.addEventListener('dragover',e=>{e.preventDefault();uploadArea.classList.add('drag-over');});
uploadArea.addEventListener('dragleave',()=>uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop',e=>{
  e.preventDefault();uploadArea.classList.remove('drag-over');
  processFiles(Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith('image/')));
});
