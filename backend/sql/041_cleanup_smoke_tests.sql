-- 040: esborra les dades de les proves automàtiques (usuaris @test.dev)
delete from colles where created_by in (select id from auth.users where email like '%@test.dev');
delete from auth.users where email like '%@test.dev';
