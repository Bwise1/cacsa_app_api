-- Location editor: branches only — do not show "App users" in admin nav (user:read).
-- Re-login after migrate so JWT/session permissions refresh.
DELETE rp FROM role_permissions rp
INNER JOIN roles r ON r.id = rp.role_id
INNER JOIN permissions p ON p.id = rp.permission_id
WHERE r.slug = 'location_editor' AND p.slug = 'user:read';
