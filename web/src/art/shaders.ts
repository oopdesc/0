// GLSL ES 3.00: GPUの各画素で光を計算する。作品の設定はJava、星の座標はRustが担当。
export const screenVertex = `#version 300 es
in vec2 position;
out vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
export const spaceFragment = `#version 300 es
precision highp float;
in vec2 uv;
out vec4 fragColor;
uniform vec2 resolution;
uniform float time;
uniform float seed;
uniform float tilt;
uniform float exposure;
uniform int scene;
uniform vec2 pointer;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7))+seed*.17)*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float a=.5,v=0.;mat2 r=mat2(.8,.6,-.6,.8);for(int i=0;i<5;i++){v+=a*noise(p);p=r*p*2.06+13.7;a*=.5;}return v;}
mat2 rot(float a){return mat2(cos(a),-sin(a),sin(a),cos(a));}
vec3 stars(vec2 p){vec3 c=vec3(0);for(int i=0;i<3;i++){float layer=float(i);vec2 q=p*(115.+layer*80.);vec2 cell=floor(q),f=fract(q)-.5;float n=hash(cell+layer*200.);vec2 off=vec2(hash(cell+7.),hash(cell+23.))*.6-.3;float d=length(f-off);float dotStar=.002/(d*d+.004);float gate=step(.985-layer*.003,n);float pulse=.8+.2*sin(time*.2+n*90.);vec3 color=mix(vec3(.55,.7,1.),vec3(1.,.76,.57),hash(cell+35.));c+=color*dotStar*gate*pulse*(.11-layer*.025);}return c;}
vec3 galaxy(vec2 p){vec2 q=rot(-.28+time*.012)*p;q.y/=max(.24,1.-tilt*.63);float r=length(q);float n=fbm(q*12.);float dust=pow(fbm(q*7.),3.)*exp(-r*4.);vec3 c=vec3(.12,.18,.30)*dust*.24;c+=vec3(.9,.62,.37)*exp(-r*r*170.)*.25;c*=smoothstep(.024,.038,r);c+=vec3(.7,.36,.12)*exp(-pow((r-.031)*210.,2.))*.4;return c;}
vec3 nebula(vec2 p){vec2 q=rot(-.25)*p*1.7;float t=time*.016;vec2 warp=vec2(fbm(q+vec2(t,3.7)),fbm(q+vec2(6.2,-t)));float n=fbm(q*2.8+warp*3.2);float ridges=pow(max(0.,1.-abs(n-.51)*2.),3.);float cloud=fbm(q*4.+warp*2.);float tear=smoothstep(.36,.66,fbm(q*3.+4.));vec3 teal=vec3(.08,.75,.72)*ridges*cloud*1.8;vec3 magenta=vec3(.85,.10,.48)*pow(n,2.)*1.1;vec3 gold=vec3(1.,.48,.13)*pow(max(0.,cloud-.4)*3.,3.);vec3 c=(teal+magenta+gold)*(1.-tear*.83);c+=vec3(.3,.52,.8)*pow(1.-length(p)*.5,3.)*.04;return c;}
vec3 horizon(vec2 p){vec2 q=rot(-.20)*p;float r=length(q);vec2 disk=q;disk.y/=max(.13,.43-tilt*.22);float dr=length(disk),a=atan(disk.y,disk.x);float grain=fbm(vec2(a*9.+time*.4,dr*22.));float ring=exp(-pow((dr-.40)*13.,2.));float outer=exp(-pow((dr-.49)*7.,2.))*.3;vec3 fire=mix(vec3(1.1,.22,.035),vec3(1.8,.95,.45),grain);float doppler=.65+.65*smoothstep(-.45,.35,q.x);vec3 c=fire*(ring+outer)*(.5+grain)*doppler;float lens=exp(-pow((r-.245)*75.,2.));float crown=exp(-pow((length(vec2(q.x,q.y*.91))-.282)*45.,2.))*smoothstep(-.02,.19,q.y);c+=vec3(1.7,.86,.38)*(lens*.65+crown*.55);c*=smoothstep(.220,.238,r);c+=vec3(.28,.075,.03)*exp(-r*4.);return c;}
void main(){vec2 p=(gl_FragCoord.xy-resolution*.5)/min(resolution.x,resolution.y);p/=1.12;p+=pointer*.022;vec3 c=vec3(.002,.003,.012);vec2 cloudUV=p+vec2(seed*.00003,0);if(scene==0)c+=galaxy(cloudUV);else if(scene==1)c+=horizon(cloudUV);else c+=nebula(cloudUV);vec2 lens=p;if(scene==1)lens*=1.+.018/(dot(p,p)+.08);c+=stars(lens);float vignette=1.-smoothstep(.3,1.15,length(p))*.52;c*=vignette;c=1.-exp(-max(c,0.)*exposure*1.25);c=pow(c,vec3(.72));float dither=(hash(gl_FragCoord.xy)-.5)/255.;fragColor=vec4(c+dither,1.);}`;
export const pointsVertex = `#version 300 es
precision highp float;
in vec4 star;
uniform vec2 resolution;
uniform float angle;
uniform float tilt;
uniform float zoom;
uniform float dpr;
out float light;
out float warmth;
void main(){float radius=length(star.xy);float orbital=angle*(.3+1.0/(radius+.2));float ca=cos(orbital),sa=sin(orbital);vec3 p=vec3(star.x*ca-star.y*sa,star.x*sa+star.y*ca,star.z);float sy=sin(tilt),cy=cos(tilt);vec3 v=vec3(p.x,p.y*cy-p.z*sy,p.y*sy+p.z*cy);float perspective=2.3/(2.3+v.z*.3);vec2 scale=vec2(resolution.y/resolution.x,1.);gl_Position=vec4(v.xy*scale*zoom*perspective,0.,1.);gl_PointSize=(.65+pow(star.w,7.)*2.8)*dpr*perspective;light=star.w;warmth=fract(star.x*27.);}`;
export const pointsFragment = `#version 300 es
precision highp float;
in float light;
in float warmth;
out vec4 fragColor;
void main(){float d=length(gl_PointCoord-.5)*2.;float glow=exp(-d*d*4.);vec3 c=mix(vec3(.45,.62,1.),vec3(1.,.79,.63),warmth);fragColor=vec4(c*glow*light*.34,glow);}`;
