export const fullVertex = `#version 300 es
precision highp float;
out vec2 vUv;
void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);vUv=p;gl_Position=vec4(p*2.0-1.0,0.,1.);}`;

export const volumeFragment = `#version 300 es
precision highp float;
precision highp sampler3D;
in vec2 vUv; out vec4 outColor;
uniform sampler3D uNoise;
uniform vec3 uOrigin;
uniform mat3 uCamera;
uniform float uAspect,uTime;
uniform int uSteps;
float n(vec3 p){return texture(uNoise,p).r;}
float cloud(vec3 p){
 vec3 warp=vec3(n(p*.024+vec3(.13,.61,.33)),n(p*.024+vec3(.73,.21,.13)),n(p*.024+vec3(.31,.11,.83)))-.5;
 vec3 q=p+warp*1.35;
 return n(q*.044)*.46+n(q*.103+vec3(.4,.1,.7))*.27+n(q*.237+vec3(.1,.8,.2))*.17+n(q*.527)*.10;
}
void main(){
 vec2 uv=(vUv-.5)*2.;
 vec3 rd=normalize(uCamera*vec3(uv.x*uAspect*.47,uv.y*.47,1.));
 vec3 color=vec3(.004,.008,.019);float trans=1.;
 float dt=6.8/float(uSteps);
 float jitter=n(vec3(vUv*1.2,.76))*.8;
 for(int i=0;i<64;i++){
  if(i>=uSteps)break;
  float t=1.6+(float(i)+jitter)*dt;
  vec3 p=uOrigin+rd*t;
  float edge=1.-smoothstep(2.7,4.4,length(p*vec3(.7,.6,1.25)));
  float f=cloud(p+vec3(uTime*.001,0.,0.));
  float spine=p.x*.56+sin(p.y*.72)*.82+p.z*.12;
  float band=exp(-spine*spine*.6);
  float cavity=smoothstep(.45,1.55,length(p.xy-vec2(.36,.42))+(f-.5)*2.8);
  float detail=pow(smoothstep(.43,.67,f),1.6);
  float density=detail*edge*band*cavity*2.2;
  float radius=clamp(.52-p.y*.14,.18,.95);
  float pillarDistance=length(vec2(p.x+1.05+sin(p.y*2.2)*.07,p.z-.85));
  float pillar=(1.-smoothstep(radius*(.5+f*.6),radius*(1.+f*.4),pillarDistance))*(1.-smoothstep(.25,.85,p.y));
  density=max(density,pillar*edge*2.8);
  float dust=pow(smoothstep(.44,.71,n(p*.086+vec3(.24,.6,.12))),2.5);
  float relief=clamp((f-cloud(p+vec3(-.10,.13,.07)))*8.+.38,.05,1.);
  float fibers=pow(1.-abs(n((p+vec3(f*.7,0.,f*.3))*.48)-.5)*2.,5.);
  float shade=exp(-dust*3.2-pillar*2.6);
  float l1=1.4/(.55+dot(p-vec3(.4,.4,.6),p-vec3(.4,.4,.6))*.7);
  float l2=.7/(.8+dot(p-vec3(-1.2,-.85,.2),p-vec3(-1.2,-.85,.2))*.65);
  float warm=smoothstep(.3,1.7,p.y*.6-p.x*.65+p.z*.14)*smoothstep(.4,.67,f);
  vec3 cold=mix(vec3(.012,.044,.11),vec3(.12,.48,.66),clamp(f*1.25,0.,1.));
  vec3 gold=mix(vec3(.24,.065,.025),vec3(1.,.59,.20),clamp(f*1.25,0.,1.));
  vec3 tint=mix(cold,gold,warm*.85);
  vec3 light=(tint*(.1+l1*1.4+l2*.9)*(.22+relief*1.65)+vec3(.63,.82,.91)*pow(l1*.22,2.))*shade;
  light*=.72+fibers*.8;
  light+=vec3(.13,.34,.43)*pillar*(1.-pillar)*l1*1.7;
  float a=1.-exp(-density*dt*1.15);
  color+=trans*a*light;
  trans*=exp(-density*dt*(1.05+dust*.9));
  if(trans<.025)break;
 }
 color=vec3(1.)-exp(-color*2.5);
 color=pow(max(color,vec3(0.)),vec3(1.02));
 outColor=vec4(color,trans);
}`;

export const compositeFragment = `#version 300 es
precision highp float;
in vec2 vUv;out vec4 outColor;uniform sampler2D uCloud;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec2 texel=1./vec2(textureSize(uCloud,0));vec3 c=texture(uCloud,vUv).rgb;vec3 blur=(texture(uCloud,vUv+vec2(texel.x,0.)).rgb+texture(uCloud,vUv-vec2(texel.x,0.)).rgb+texture(uCloud,vUv+vec2(0.,texel.y)).rgb+texture(uCloud,vUv-vec2(0.,texel.y)).rgb)*.25;c=max(vec3(0.),c+(c-blur)*.65);float vignette=1.-smoothstep(.45,1.4,length((vUv-.5)*vec2(1.,.85)));c*=.72+.28*vignette;c+=(h(gl_FragCoord.xy)-.5)*.003;outColor=vec4(c,1.);}`;

export const starVertex = `#version 300 es
precision highp float;
layout(location=0)in vec3 aPosition;layout(location=1)in vec3 aColor;layout(location=2)in float aMagnitude;
uniform vec3 uOrigin;uniform mat3 uCamera;uniform float uAspect,uPixelRatio;uniform vec2 uResolution;
out vec3 vColor;out float vMagnitude;
void main(){vec3 p=transpose(uCamera)*(aPosition-uOrigin);gl_Position=vec4(p.x/(uAspect*.47),p.y/.47,p.z-.1,p.z);gl_PointSize=clamp((1.1+aMagnitude*68.)*uPixelRatio,1.,96.);vColor=aColor;vMagnitude=aMagnitude;}`;
export const starFragment = `#version 300 es
precision highp float;
in vec3 vColor;in float vMagnitude;out vec4 outColor;
uniform sampler2D uCloud;uniform vec2 uResolution;
void main(){vec2 p=(gl_PointCoord-.5)*2.;float r=length(p);if(r>1.)discard;
 float core=exp(-r*r*(28.+vMagnitude*20.));float halo=exp(-r*4.)*(.08+vMagnitude*.22);
 float spike=(exp(-abs(p.x)*100.)*exp(-abs(p.y)*4.)+exp(-abs(p.y)*100.)*exp(-abs(p.x)*4.))*.18*vMagnitude;
 float visibility=.38+.62*texture(uCloud,gl_FragCoord.xy/uResolution).a;
 vec3 c=vColor*(core+halo+spike)*(.48+vMagnitude*2.0)*visibility;
 outColor=vec4(c,1.);}`;
