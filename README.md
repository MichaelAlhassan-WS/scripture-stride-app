# FaithTrack Daily

FaithTrack – Bible Study Accountability App

Build a modern web application called FaithTrack.

FaithTrack is a private Bible Study Accountability Platform designed for churches, discipleship groups, leadership teams, and Bible study communities.

The purpose of the platform is to help users maintain consistent Bible study habits while allowing leaders to monitor participation and encourage members.

Design Requirements

Create a clean, modern, premium Christian-themed design.

Style:

Modern and minimal

Mobile-first responsive design

Clean typography

Professional dashboard layouts

Light theme

Warm and welcoming interface

Elegant cards and statistics panels

Colors:

Deep blue

White

Gold accents

Soft gray backgrounds

Authentication

Implement:

User Registration

User Login

Password Reset

Email Verification

Roles:

Administrator

Group Leader

Member

Users must only access features permitted by their role.

User Dashboard

After login, members should see:

Today's Reading

Display the assigned reading plan for the day.

Example:

Romans 8

Include:

Mark Completed button

Reading progress indicator

Personal Statistics

Display:

Current Streak

Longest Streak

Total Reading Sessions

Chapters Completed This Month

Recent Activity

Show the user's latest study entries.

Bible Reader

Include an in-app Bible reader using the King James Version (KJV).

Features:

Browse books

Browse chapters

Browse verses

Search scripture

Bookmark passages

Highlight passages

Mark chapter completed

Track:

Chapters viewed

Time spent reading

Completion status

External Study Logging

Allow users to log Bible study completed outside the app.

Fields:

Bible Book

Chapter

Verse Range

Time Studied

Reflection Notes

Example:

Book: John

Chapter: 15

Verses: 1-17

Duration: 20 minutes

Reflection: Abiding in Christ produces fruit.

Store all submissions in the database.

Visibility Modes

Implement three visibility settings.

Private Mode

Members see only their own progress.

Leaders and administrators see all progress.

Anonymous Mode

Members see group statistics only.

Example:

18 of 22 members completed today's reading.

Group Streak: 12 Days

Weekly Completion Rate: 84%

No names displayed.

Group Mode

Members can see participation of other group members.

Display:

Completion status

Reading streaks

Activity history

Groups

Administrators can:

Create groups

Assign leaders

Assign members

Examples:

Leadership Team

Workers

Bible Study Class

Discipleship Group

Reading Plans

Administrators can create reading plans.

Examples:

30 Day Gospel of John

New Testament in 90 Days

One Year Bible Plan

Reading plans should automatically appear on member dashboards.

Notifications

Create reminder functionality.

Daily reminder:

"Don't forget today's Bible study."

Streak reminder:

"You're one day away from a 7-day streak."

Leader Dashboard

Group leaders can view:

Assigned groups

Group completion rates

Member activity

Reading streaks

Missed study days

Leaders cannot manage global application settings.

Administrator Dashboard

Administrators can view:

Statistics

Total Users

Active Users

Completion Rate

Group Streak

Reading Activity

User Management

View users

Create users

Edit users

Disable users

Group Management

Create groups

Assign leaders

Manage members

Reports

Generate:

Daily Reports

Weekly Reports

Monthly Reports

Allow export to PDF and Excel.

Database

Use Supabase.

Tables should include:

users

groups

group_members

reading_plans

reading_assignments

study_logs

reading_sessions

notifications

Implement proper relationships between tables.

Security

Use Supabase Authentication.

Implement role-based permissions.

Members should not access administrator functions.

Group leaders should only access assigned groups.

Deployment

Prepare the project for deployment on Vercel.

Generate all pages, database schema, authentication flows, dashboards, and responsive UI.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://scripture-stride-app.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/661e6bf0-194a-48cb-8ace-92f184ce33a5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
