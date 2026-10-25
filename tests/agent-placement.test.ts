import assert from "node:assert/strict";
import { test } from "node:test";
import type { Editor, TLShapeId } from "tldraw";
import { executeCanvasTool, createDrawingPlacement } from "../lib/agent-canvas";
import { reservedDrawingEdge, drawingShift } from "../lib/agent-placement";
import { imageUploadProps } from "../lib/image-upload";

test("uploaded image retains the latest width, alignment, and caption", () => {
 const props = { previewWidth: 140, textAlignment: "right", caption: "My image" };
 assert.deepEqual(imageUploadProps(props, "/uploads/test.png", "test.png", 500), {
  ...props, url: "/uploads/test.png", name: "test.png",
 });
 assert.equal(imageUploadProps({}, "/a.png", "a.png", 170).previewWidth, 170);
});

test("drawing boundary uses the full width of existing artwork", () => {
 assert.equal(reservedDrawingEdge([{x:-200,y:0,w:900,h:300}]), 1020);
 assert.equal(drawingShift(1020,[{x:800,y:0,w:300,h:100}]),220);
 assert.equal(reservedDrawingEdge([]),null);
});

test("agent tools reserve empty space and keep a whole task clear of user artwork", () => {
 type Shape = {id: TLShapeId; type: string; x:number; y:number; props: {w?:number;h?:number}};
 const user: Shape = {id:"shape:user" as TLShapeId,type:"geo",x:100,y:50,props:{w:1200,h:500}};
 const original = JSON.stringify(user);
 const records = new Map<TLShapeId,Shape>([[user.id,user]]);
 const editor = {
  getCurrentPageShapes:()=>[...records.values()],
  getShape:(id:TLShapeId)=>records.get(id),
  getShapePageBounds:(value:TLShapeId|Shape)=>{
   const s=typeof value==='string'?records.get(value):value;
   return s?{x:s.x,y:s.y,w:s.props.w??200,h:s.props.h??100}:undefined;
  },
  createShape:(s:Shape)=>records.set(s.id,s),
  updateShapes:(updates:Partial<Shape>[])=>updates.forEach(s=>Object.assign(records.get(s.id!)!,s)),
 } as unknown as Editor;
 const placement=createDrawingPlacement();const ids=new Map<string,TLShapeId>();
 assert.equal(executeCanvasTool(editor,ids,"createRectangle",{id:"first",position:{x:0,y:0},width:200,height:100},placement).success,true);
 executeCanvasTool(editor,ids,"createText",{id:"title",position:{x:-500,y:-200},text:"CRUD plan"},placement);
 const shapes=[...placement.ids].map(id=>records.get(id)!);
 assert.ok(shapes.every(s=>s.x>=1620));
 assert.equal(records.get(ids.get("first")!)!.x-records.get(ids.get("title")!)!.x,500);
 assert.equal(JSON.stringify(user),original);
 const second=createDrawingPlacement();const secondIds=new Map<string,TLShapeId>();
 executeCanvasTool(editor,secondIds,"createEllipse",{id:"first",position:{x:0,y:0},width:150,height:80},second);
 const newest=records.get(secondIds.get("first")!)!;
 assert.ok(newest.x>=Math.max(...shapes.map(s=>s.x+(s.props.w??200)))+320);
});
