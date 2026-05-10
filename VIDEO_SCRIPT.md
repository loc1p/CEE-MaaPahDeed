# บทพูดวิดีโอ Final Project: MaaPahDeed

ความยาวเป้าหมาย: 7-9 นาที  
ความยาวสูงสุดตามโจทย์: 10 นาที

## 0:00-0:45 Introduction

พูด:

สวัสดีครับ/ค่ะ นี่คือโปรเจกต์ Final Project วิชา Computer Engineering Essential แอปของเราชื่อว่า MaaPahDeed เป็นเว็บแอปสำหรับฝึกกีตาร์ในรูปแบบ RPG ผู้ใช้สามารถฝึกคอร์ดผ่าน Battle mode, ค้นหาคอร์ดจากเพลงจริง, ดูตำแหน่งนิ้วบน fretboard, บันทึกเพลงที่ชอบ และใช้ Chord Cam ที่รับภาพจากกล้องเพื่อสร้างประสบการณ์ interactive guitar

ปัญหาที่แอปนี้ต้องการแก้คือ ผู้เริ่มต้นฝึกกีตาร์มักจำตำแหน่งคอร์ดยาก และการฝึกซ้ำๆ อาจน่าเบื่อ MaaPahDeed จึงทำให้การฝึกคอร์ดเป็นเกม พร้อม feedback และภาพตำแหน่งนิ้วเพื่อช่วยให้เข้าใจง่ายขึ้น

โชว์:

- เปิดหน้าเว็บ
- ชี้ชื่อแอป MaaPahDeed
- ชี้เมนู Battle และ Chord Cam

## 0:45-2:00 Basic Requirement 1: User Login

พูด:

Requirement แรกคือ User Login แอปนี้ไม่ได้ใช้ username/password แบบ hardcoded แต่ผู้ใช้สามารถสร้างบัญชีของตัวเอง login, logout และ restore session ได้จริง

ฝั่ง backend ใช้ MongoDB เก็บข้อมูลผู้ใช้ รหัสผ่านถูก hash ด้วย bcrypt และใช้ JWT สำหรับจัดการ session

โชว์:

1. เปิดเว็บจาก public URL ในแท็บใหม่
2. กด Register
3. สร้างบัญชีทดสอบ
4. หลังสมัครเสร็จให้ login เข้าแอป
5. กด Log Out
6. Login ด้วยบัญชีเดิม
7. Refresh หน้าเว็บ แล้วโชว์ว่ายังอยู่ใน session เดิมหรือสามารถ restore session ได้

## 2:00-3:30 Basic Requirement 2: API Integration

พูด:

Requirement ต่อมาคือ API Integration แอปนี้เชื่อมต่อ external API หลายส่วนเพื่อใช้ใน core feature ไม่ได้แค่ดึงข้อมูลมาแสดงเฉยๆ

ส่วน Song Chord Quest ใช้ backend ไปดึงคอร์ดเพลงจาก external song/chord source แล้วนำคอร์ดที่ได้มาใช้เป็น target ใน Battle mode ส่วน guitar fretboard guide จะใช้ chord shape ในเครื่องก่อน ถ้าไม่มีคอร์ดนั้นใน local shape list backend จะ fetch ตำแหน่งนิ้วจาก All Guitar Chords ผ่าน endpoint `/api/chords/shape`

แอปยังจัดรูปแบบชื่อคอร์ดให้ถูกต้อง เช่น `Bb` แสดงเป็น `Bb` ไม่ใช่ `BB`

โชว์:

1. ไปที่หน้า Battle
2. ใน Song Chord Quest กรอกชื่อศิลปินและเพลง
   ตัวอย่าง:
   - Artist: Maroon 5
   - Song: This Love
3. กด Load Chords
4. โชว์ chord list และ source
5. ชี้ให้เห็นว่าคอร์ดที่โหลดมาถูกนำไปใช้เป็น target ใน Battle
6. โชว์ flat chord เช่น `Bb` ว่าแสดงผลถูกต้อง
7. ชี้ fretboard guide ว่า common chord ใช้ local shape และคอร์ดที่ไม่มีใน local จะโหลด shape จาก All Guitar Chords

ถ้าต้องการโชว์เพิ่ม:

- เปิด DevTools > Network
- ชี้ request เช่น `/api/music/chords` และ `/api/chords/shape`
- อธิบายว่า frontend เรียก backend และ backend ไปดึงข้อมูลจาก external API

## 3:30-4:10 Basic Requirement 3: Deployed and Live

พูด:

Requirement ที่สามคือ Deployed and Live แอปนี้เปิดได้จาก public URL ไม่ใช่แค่ localhost ตอน demo จะเปิดเว็บจากลิงก์ deploy จริงเพื่อยืนยันว่าใช้งานออนไลน์ได้

ลิงก์ live ของโปรเจกต์คือ `https://project-5101d58b-03f9-4d7e-a71.web.app/` ซึ่งเป็น frontend ที่ deploy บน Firebase Hosting และ backend API อยู่ที่ `https://maapahdeed.onrender.com/api`

โชว์:

- แถบ address bar ที่เป็น public Firebase URL
- เปิด `https://maapahdeed.onrender.com/api/health` สั้นๆ เพื่อโชว์ว่า backend ทำงาน
- Refresh หน้าเว็บ
- ใช้งาน feature สั้นๆ ให้เห็นว่าเว็บทำงานจริง

พูด:

Source code อยู่บน GitHub และใน repository มี README อธิบายวิธี setup/run project ส่วน secret และค่า config ส่วนตัวจะไม่ถูก commit ขึ้น GitHub แต่เก็บในไฟล์ `.env`

โปรเจกต์นี้ deploy frontend ผ่าน Firebase Hosting โดยใช้ไฟล์ `firebase.json` และ deploy backend ผ่าน Render โดยมีไฟล์ `render.yaml` ให้ Render อ่านเป็น Blueprint ส่วน database ใช้ MongoDB Atlas สำหรับระบบ login, saved songs และ dashboard

## 4:10-5:40 Core App Walkthrough: Battle Mode

พูด:

ต่อไปเป็น feature หลักของแอป คือ Battle mode ในหน้านี้ผู้ใช้จะได้รับ target เป็นคอร์ดกีตาร์ เช่น C, G, D, Am หรือคอร์ดจากเพลงจริง แอปจะแสดงชื่อคอร์ด, chord tones และตำแหน่งนิ้วบน fretboard

ถ้าเป็นคอร์ดพื้นฐาน แอปจะใช้ local chord shape เพื่อให้โหลดเร็ว ถ้าเป็นคอร์ดที่ไม่มีใน local shape list แอปจะเรียก backend เพื่อดึง chord shape จาก All Guitar Chords แล้วนำมาวาดบน fretboard

โชว์:

1. กด Begin the Quest
2. กดอนุญาต microphone ถ้ามี popup
3. โชว์ target chord
4. โชว์ fretboard guide ที่มีตำแหน่งนิ้ว
5. กด Hear Note หรือปุ่มเล่นเสียง
6. เล่น/ดีดคอร์ดกีตาร์ ถ้าทำได้
7. โชว์ช่อง Chord ที่แสดงคอร์ดล่าสุดที่เล่นถูก
8. โชว์ score, streak, monster HP และ battle log

พูด:

Battle mode ช่วยให้การฝึกคอร์ดมีความเป็นเกมมากขึ้น ผู้ใช้ไม่ได้แค่จำคอร์ดจากตาราง แต่ได้ฝึกผ่าน target, feedback และ progress ในเกม เมื่อเล่นคอร์ดถูก แอปจะนับ hit และแสดงคอร์ดนั้นค้างไว้ในช่อง Chord จนกว่าจะเล่นถูกคอร์ดใหม่

## 5:40-6:50 Challenging Requirement: Tier S Computer Vision

พูด:

สำหรับ Challenging Requirement เราเลือกเคลม Tier S: Computer Vision ผ่าน feature Chord Cam

Chord Cam ใช้กล้องของผู้ใช้เป็น input แล้วใช้ computer vision จาก MediaPipe เพื่อตรวจจับมือหรือท่าทาง จากนั้นนำข้อมูลนั้นมาใช้เป็น interaction ในแอป

โชว์:

1. ไปที่เมนู Chord Cam
2. กดเริ่มกล้อง หรือ allow camera permission
3. ขยับมือหน้ากล้อง
4. โชว์ว่าแอปตอบสนองจากภาพกล้อง

พูด:

Feature นี้ตรงกับ Computer Vision เพราะข้อมูลภาพจากกล้องเป็น input หลักของระบบ แอปไม่ได้ใช้กล้องเป็นแค่ decoration แต่ใช้ภาพเพื่อเข้าใจ movement และทำ interaction กับประสบการณ์ฝึกกีตาร์

## 6:50-8:20 Additional Feature: Saved Songs / Favorites

พูด:

นอกจาก Tier S แล้ว แอปยังมี Saved Songs ซึ่งเข้ากับ Tier B: Saved / Favorites เพราะผู้ใช้แต่ละคนสามารถบันทึกเพลงของตัวเอง และกลับมาใช้ภายหลังได้

โชว์:

1. ค้นหาเพลงใน Song Chord Quest
2. กด Save Current Song
3. โชว์ว่าเพลงเข้าไปอยู่ใน Saved Songs
4. Refresh หน้าเว็บ
5. โชว์ว่าเพลงยังอยู่ ไม่หายหลัง refresh
6. แก้ note ของเพลงที่ save
7. ลบเพลงออกจาก Saved Songs

พูด:

ตรงนี้เป็น CRUD ครบ คือ create จากการ save, read จากการแสดง saved list, update จากการแก้ note และ delete จากการลบเพลง ทั้งหมดผูกกับ account ของผู้ใช้

## 8:20-9:05 Additional Feature: Dashboard and Data Visualization

พูด:

อีก feature หนึ่งคือ Song Library Dashboard ซึ่งแสดงข้อมูลจาก backend ในรูปแบบที่อ่านง่าย เช่น recent songs, saved songs และ top searched songs

โชว์:

1. ชี้ส่วน Recent Songs
2. ชี้ส่วน Saved Songs
3. ชี้ส่วน Top Searched Songs หรือ chart/list dashboard
4. ค้นหาเพลงเพิ่มถ้าต้องการโชว์ว่าข้อมูลเปลี่ยน

พูด:

Dashboard นี้ใช้ข้อมูลจริงจาก backend ไม่ใช่ตัวเลข hardcoded จึงช่วยให้ผู้ใช้เห็นภาพรวมของเพลงที่เคยค้นหาและเพลงที่บันทึกไว้

## 9:05-9:30 Additional Feature: Light/Dark Theme Toggle

พูด:

แอปยังมี Theme Toggle สำหรับสลับระหว่าง Dark mode และ Light mode ซึ่งตรงกับ Tier C: Dark Mode / Theme Toggle ผู้ใช้สามารถเลือกโหมดที่อ่านง่ายกับตัวเอง และเว็บจะจำค่าที่เลือกไว้หลัง refresh

โชว์:

1. กดปุ่ม Light บน navbar
2. โชว์ว่า UI เปลี่ยนเป็น Light mode
3. กดปุ่ม Dark เพื่อกลับ Dark mode
4. Refresh หน้าเว็บ แล้วโชว์ว่า theme ยังจำค่าล่าสุด

## 9:30-9:55 Closing

พูด:

สรุปแล้ว MaaPahDeed ครบ Basic Requirements คือมี User Login, มี External API Integration ที่ใช้จริงใน core feature และ deploy เป็นเว็บที่เข้าถึงได้ผ่าน public URL

สำหรับ Challenging Requirement เราเคลม Tier S: Computer Vision ผ่าน Chord Cam และยังมี feature เพิ่มเติมคือ Saved Songs, Song Library Dashboard และ Light/Dark Theme Toggle

Source code อยู่บน GitHub พร้อม README สำหรับ setup/run project และค่า config ส่วนตัวถูกจัดการผ่าน `.env` โดยไม่ commit secret ขึ้น repository

โชว์:

- หน้า GitHub repository
- README
- `.env.example` ที่ไม่มี secret จริง

## Notes ก่อนอัดวิดีโอ

- ความยาวต้องไม่เกิน 10 นาที
- ใช้ public URL ตอนอัดคลิปส่งจริง ไม่ใช้ localhost
- ห้ามโชว์ไฟล์ `backend/.env` ที่มี secret จริง
- ถ้าต้องโชว์ env ให้โชว์ `.env.example` แทน
- ถ้ามี popup ขอ permission กล้อง/ไมค์ ให้กด allow แล้วอธิบายว่า feature นี้ต้องใช้ browser permission
- ถ้า external API fail ระหว่างอัด ให้ลองใหม่ก่อน หรืออธิบาย fallback สั้นๆ แล้วอัดรอบใหม่ถ้าเป็นไปได้
