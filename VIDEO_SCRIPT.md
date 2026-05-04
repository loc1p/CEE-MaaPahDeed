# บทพูดวิดีโอ Final Project: MaaPahDeed

ความยาวเป้าหมาย: 7-9 นาที  
ความยาวสูงสุดตามโจทย์: 10 นาที

## 0:00-0:45 Introduction

พูด:

สวัสดีครับ/ค่ะ นี่คือโปรเจกต์ Final Project วิชา Computer Engineering Essential แอปของเราชื่อว่า MaaPahDeed เป็นเว็บแอปสำหรับฝึกกีตาร์ในรูปแบบ RPG โดยผู้ใช้สามารถฝึกคอร์ดกีตาร์ผ่าน Battle mode, ค้นหาคอร์ดจากเพลงจริง, บันทึกเพลงที่ชอบ และใช้ Chord Cam ที่รับภาพจากกล้องเพื่อทำ interactive guitar experience

ปัญหาที่แอปนี้ต้องการแก้คือ การฝึกกีตาร์สำหรับผู้เริ่มต้นมักจำตำแหน่งคอร์ดยาก และฝึกซ้ำ ๆ แล้วน่าเบื่อ MaaPahDeed จึงเปลี่ยนการฝึกคอร์ดให้เป็นเกม พร้อมแสดงตำแหน่งนิ้วบน fretboard เพื่อให้ฝึกได้เข้าใจง่ายขึ้น

โชว์:

- เปิดหน้าเว็บ
- ชี้ชื่อแอป MaaPahDeed
- ชี้เมนู Battle และ Chord Cam

## 0:45-2:00 Basic Requirement 1: User Login

พูด:

Requirement แรกคือ User Login แอปนี้ไม่ได้ใช้ username/password แบบ hardcoded หรือ account เดียวร่วมกัน แต่ผู้ใช้สามารถสร้างบัญชีของตัวเอง แล้ว login/logout ได้จริง

โชว์:

1. เปิดเว็บจาก public URL ในแท็บใหม่
2. กด Register
3. สร้างบัญชีทดสอบ
4. หลังสมัครเสร็จ โชว์ว่าเข้าแอปได้
5. กด Log Out
6. Login ด้วยบัญชีเดิม
7. Refresh หน้าเว็บ แล้วโชว์ว่ายังอยู่ใน session เดิมหรือสามารถ restore session ได้

พูด:

ฝั่ง backend ใช้ MongoDB เก็บข้อมูลผู้ใช้ รหัสผ่านถูก hash ด้วย bcrypt และใช้ JWT สำหรับจัดการ session ของผู้ใช้

## 2:00-3:20 Basic Requirement 2: API Integration

พูด:

Requirement ต่อมาคือ API Integration แอปนี้เชื่อมต่อ external API เพื่อค้นหาคอร์ดจากเพลงจริง แล้วนำผลลัพธ์มาใช้เป็นเป้าหมายใน Battle mode ไม่ได้แค่แสดงข้อมูลเฉย ๆ

โชว์:

1. ไปที่หน้า Battle
2. ในส่วน Song Chord Quest กรอกชื่อศิลปินและเพลง
   ตัวอย่าง:
   - Artist: Conan Gray
   - Song: Eleven Eleven
3. กด Load Chords
4. โชว์ผลลัพธ์ที่ได้ เช่น chord list และ source
5. ชี้ให้เห็นว่า chord ที่โหลดมาถูกนำไปใช้เป็น target ใน Battle

พูด:

ตรงนี้ถือเป็น meaningful API integration เพราะข้อมูลจาก API ถูกใช้เป็น core functionality ของแอป คือใช้สร้างเป้าหมายคอร์ดให้ผู้ใช้ฝึกเล่นในเกม

ถ้าต้องการโชว์เพิ่ม:

- เปิด DevTools > Network
- ชี้ request เช่น `/api/music/song-chords`
- อธิบายว่า frontend เรียก backend และ backend ไปดึงข้อมูลจาก external API

## 3:20-4:00 Basic Requirement 3: Deployed and Live

พูด:

Requirement ที่สามคือ Deployed and Live แอปนี้ต้องเปิดได้จาก public URL ไม่ใช่ localhost ในการ demo จะเปิดเว็บจากลิงก์ deploy จริงในแท็บใหม่เพื่อยืนยันว่าใช้งานออนไลน์ได้

โชว์:

- แถบ address bar ที่เป็น public URL
- Refresh หน้าเว็บ
- ใช้งาน feature สั้น ๆ ให้เห็นว่าเว็บทำงานจริง

พูด:

Source code อยู่บน GitHub และใน repository มี README อธิบายวิธี setup/run project ส่วน API key จะไม่ถูก commit ขึ้น GitHub แต่เก็บในไฟล์ `.env`

## 4:00-5:30 Core App Walkthrough: Battle Mode

พูด:

ต่อไปเป็น feature หลักของแอป คือ Battle mode ในหน้านี้ผู้ใช้จะได้รับ target เป็นคอร์ดกีตาร์ เช่น C, G, D, Am หรือคอร์ดจากเพลงจริง แอปจะแสดงชื่อคอร์ด, chord tones และตำแหน่งกดนิ้วบน fretboard

โชว์:

1. กด Begin the Quest
2. กดอนุญาต microphone ถ้ามี popup
3. โชว์ target chord
4. โชว์ fretboard guide ที่มีตำแหน่งนิ้ว
5. กด Hear Note หรือปุ่มเล่นเสียง
6. เล่น/ดีดคอร์ดกีตาร์ ถ้าทำได้
7. โชว์ score, streak, monster HP และ battle log

พูด:

Battle mode ช่วยให้การฝึกคอร์ดมีความเป็นเกมมากขึ้น ผู้ใช้ไม่ได้แค่จำคอร์ดจากตาราง แต่ได้ฝึกผ่าน target, feedback และ progress ในเกม

## 5:30-6:40 Challenging Requirement: Tier S Computer Vision

พูด:

สำหรับ Challenging Requirement เราเลือกเคลม Tier S: Computer Vision ผ่าน feature Chord Cam

Chord Cam ใช้กล้องของผู้ใช้เป็น input แล้วใช้ computer vision จาก MediaPipe เพื่อตรวจจับมือหรือท่าทาง และนำข้อมูลนั้นมาใช้เป็น interaction ในแอป

โชว์:

1. ไปที่เมนู Chord Cam
2. กดเริ่มกล้อง หรือ allow camera permission
3. ขยับมือหน้ากล้อง
4. โชว์ว่าแอปตอบสนองจากภาพกล้อง

พูด:

Feature นี้ตรงกับ Computer Vision เพราะข้อมูลภาพจากกล้องเป็น input หลักของระบบ แอปไม่ได้ใช้กล้องเป็นแค่ decoration แต่ใช้ภาพเพื่อเข้าใจ movement และทำ interaction กับประสบการณ์ฝึกกีตาร์

## 6:40-8:10 Additional Feature: Saved Songs / Favorites

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

## 8:10-8:55 Additional Feature: Dashboard and Data Visualization

พูด:

อีก feature หนึ่งคือ Song Library Dashboard ซึ่งแสดงข้อมูลจาก backend ในรูปแบบที่อ่านง่าย เช่น recent songs, saved songs และ top searched songs

โชว์:

1. ชี้ส่วน Recent Songs
2. ชี้ส่วน Saved Songs
3. ชี้ส่วน Top Searched Songs หรือ chart/list dashboard
4. ค้นหาเพลงเพิ่มถ้าต้องการโชว์ว่าข้อมูลเปลี่ยน

พูด:

Dashboard นี้ใช้ข้อมูลจริงจาก backend ไม่ใช่ตัวเลข hardcoded จึงช่วยให้ผู้ใช้เห็นภาพรวมของเพลงที่เคยค้นหาและเพลงที่บันทึกไว้

## 8:55-9:20 Additional Feature: Light/Dark Theme Toggle

พูด:

แอปยังมี Theme Toggle สำหรับสลับระหว่าง Dark mode และ Light mode ซึ่งตรงกับ Tier C: Dark Mode / Theme Toggle ผู้ใช้สามารถเลือกโหมดที่อ่านง่ายกับตัวเอง และเว็บจะจำค่าที่เลือกไว้หลัง refresh

โชว์:

1. กดปุ่ม Light บน navbar
2. โชว์ว่า UI เปลี่ยนเป็น Light mode
3. กดปุ่ม Dark เพื่อกลับ Dark mode
4. Refresh หน้าเว็บ แล้วโชว์ว่า theme ยังจำค่าล่าสุด

พูด:

Feature นี้ช่วยเรื่อง UI/UX เพราะผู้ใช้เลือก visual theme ที่เหมาะกับสภาพแสงหรือความถนัดของตัวเองได้

## 9:20-9:55 Closing

พูด:

สรุปแล้ว MaaPahDeed ครบ Basic Requirements คือมี User Login, มี External API Integration ที่ใช้จริงใน core feature และ deploy เป็นเว็บที่เข้าถึงได้ผ่าน public URL

สำหรับ Challenging Requirement เราเคลม Tier S: Computer Vision ผ่าน Chord Cam และยังมี feature เพิ่มเติมคือ Saved Songs, Song Library Dashboard และ Light/Dark Theme Toggle

Source code อยู่บน GitHub พร้อม README สำหรับ setup/run project และ API keys ถูกจัดการผ่าน `.env` โดยไม่ commit secret ขึ้น repository

โชว์:

- หน้า GitHub repository
- README
- `.env.example` ที่ไม่มี API key จริง

## Notes ก่อนอัดวิดีโอ

- ความยาวต้องไม่เกิน 10 นาที
- ใช้ public URL ตอนอัดคลิปส่งจริง ไม่ใช้ localhost
- ห้ามโชว์ไฟล์ `backend/.env` ที่มี API key จริง
- ถ้าต้องโชว์ env ให้โชว์ `.env.example` แทน
- ถ้ามี popup ขอ permission กล้อง/ไมค์ ให้กด allow แล้วอธิบายว่า feature นี้ต้องใช้ browser permission
- ถ้า external API fail ระหว่างอัด ให้ลองใหม่ก่อน หรืออธิบาย fallback สั้น ๆ แล้วอัดรอบใหม่ถ้าเป็นไปได้
