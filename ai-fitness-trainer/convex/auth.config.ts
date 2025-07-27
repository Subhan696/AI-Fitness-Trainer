
const authConfig = {
  providers: [
    {
  "aud": "convex",
  "email": "{{user.primary_email_address}}",
  "email_verified": "{{user.email_verified}}",
  "family_name": "{{user.last_name}}",
  "given_name": "{{user.first_name}}",
  "name": "{{user.full_name}}",
  "nickname": "{{user.username}}",
  "phone_number": "{{user.primary_phone_number}}",
  "phone_number_verified": "{{user.phone_number_verified}}",
  "picture": "{{user.image_url}}",
  "updated_at": "{{user.updated_at}}"
}
  ],
};

export default authConfig;
