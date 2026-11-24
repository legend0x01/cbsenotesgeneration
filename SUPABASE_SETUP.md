# Set up Google sign-in and cloud-saved notes

NCERT Notes can save every student's generated notes to their own account, so a chapter is generated once and can then be opened on any device. This uses [Supabase](https://supabase.com) (free tier) for the database and Google sign-in.

Without this setup the site still works, but notes are saved only in the student's browser.

It takes about 15 minutes. You need a Google account and a free Supabase account.

## 1. Create a Supabase project

1. Sign in at [supabase.com/dashboard](https://supabase.com/dashboard) and click **New project**.
2. Choose a name (for example `ncert-notes`), set a database password, pick the region closest to your students (for India, **Mumbai**), and create the project.
3. Wait a minute or two for the project to finish setting up.

## 2. Create the notes table

1. In the project, open **SQL Editor** → **New query**.
2. Paste the whole of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.

This creates one table, `notes`, with Row Level Security turned on. Each signed-in student can only read, change or delete their own rows. Visitors who aren't signed in can't read anything.

3. Open another **New query**, paste the whole of [`supabase/shared_notes.sql`](supabase/shared_notes.sql) and click **Run**.

This turns on the **shared notes library**: one public copy of each chapter that any student can read instantly, even without signing in or a Gemini key. The rules are enforced by the database:

- Only signed-in students can share, through a checked function that rejects malformed, empty or oversized notes.
- A shared chapter can only be replaced by a more complete one, except by the student who shared it. A complete chapter is never replaced unless reports have hidden it.
- Each account can newly share (or take over) at most 25 chapters a day. Updating your own shared copy isn't limited.
- Who shared a chapter is never public. A first name is shown only if the student turns that on.
- When 3 different students report a chapter, it is hidden. To review it, open **Table Editor** → `shared_notes`: set `hidden` back to `false` to restore it, or delete the row.

4. Open another **New query**, paste the whole of [`supabase/free_ai.sql`](supabase/free_ai.sql) and click **Run**.

This counts free built-in AI usage in the database, so the limits hold on every Vercel server: 60 requests an hour and 200 a day per student, and 3,000 a day for everyone together. Until it is run, the server falls back to a rough per-server hourly count.

Without this step the site still works, and the sharing options simply stay switched off.

## 3. Create Google OAuth credentials

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create a project (or pick an existing one).
2. Go to **APIs & Services** → **OAuth consent screen**:
   - choose **External**;
   - fill in the app name (`NCERT Notes`), your support email and the developer contact email;
   - you don't need to add any extra scopes (the default email, profile and openid are enough);
   - publish the app (**Publish app**) so that any Google account can sign in, not just test users.
3. Go to **APIs & Services** → **Credentials** → **Create credentials** → **OAuth client ID**:
   - Application type: **Web application**;
   - **Authorized JavaScript origins**: add the address of your site, for example `http://localhost:8000` and `https://cbsenotesgeneration.vercel.app`;
   - **Authorized redirect URIs**: add `https://<your-project-ref>.supabase.co/auth/v1/callback`. Copy the exact URL from Supabase: **Authentication** → **Sign In / Providers** → **Google** shows it as the **Callback URL**.
4. Click **Create** and copy the **Client ID** and **Client secret**.

## 4. Turn on Google sign-in in Supabase

1. In Supabase open **Authentication** → **Sign In / Providers** → **Google**.
2. Turn it on, paste the **Client ID** and **Client secret**, and save.
3. Open **Authentication** → **URL Configuration**:
   - **Site URL**: your live site, `https://cbsenotesgeneration.vercel.app`;
   - **Redirect URLs**: add every address the site runs from, for example:
     - `http://localhost:8000/**`
     - `https://cbsenotesgeneration.vercel.app/**`

Sign-in only returns to addresses in this list. If it's missing, Google sign-in sends students to the Site URL instead.

## 5. Connect the site

1. In Supabase open **Project Settings** → **API** (or **Data API**).
2. Copy the **Project URL** and the **anon / public** key.
3. Paste them into [`js/config.js`](js/config.js):

```js
window.NCERT_CONFIG = {
  supabaseUrl: 'https://abcdefghijklmnop.supabase.co',
  supabaseAnonKey: 'eyJhbGciOi...'
};
```

The anon key is designed to be public and safe to commit, because Row Level Security protects the data. **Never** put the `service_role` key in the site.

## 6. Try it

Google sign-in needs the site to be served over `http://` or `https://`. Opening `index.html` directly from disk won't work.

```bash
cd NotesNcert
python -m http.server 8000
```

Open <http://localhost:8000>:

1. On a first visit, a welcome screen offers **Continue with Google** or **Continue without signing in**. Students who skip can sign in later from the **Sign in** button in the header. Click **Continue with Google** and choose an account.
2. You return to the site, signed in, with your avatar in the header.

If the welcome screen and **Sign in** button don't appear, Supabase reports that the Google provider is off: recheck step 4. If sign-in fails, the reason Google or Supabase gave is shown on the welcome screen.
3. Open a chapter and generate a part. The reader header shows **Saved to account**.
4. Open the site in another browser, sign in with the same account, and the chapter opens with the same notes and no new Gemini request.

You can see the saved rows in Supabase under **Table Editor** → **notes**.

## How syncing works

- Each chapter is one row: its topic outline, the Markdown of every generated part, and how many parts are done.
- After every part is generated, the row is saved to the account (and also kept in the browser as a cache).
- When a chapter is opened, the site uses whichever copy, device or account, has more parts.
- When a student signs in for the first time, notes they made on that device before signing in are uploaded to their account.
- **Reset** on a chapter deletes it from the device and the account.
- The Gemini API key is **not** synced. It stays in each browser, so a student pastes it once per device.

## Free-tier limits

Supabase's free plan includes a 500 MB database. A fully generated chapter is roughly 60–150 KB, so that is several thousand complete chapters across all students. Free projects pause after a week with no activity; reopen them from the dashboard.
