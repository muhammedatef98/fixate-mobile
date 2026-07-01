-- Approval notifications (in-app bell layer).
--
-- Two gaps fixed here; the matching push notifications are sent client-side
-- via notifyUsers() in adminApprove / adminApproveVerification.
--
-- 1. Listing approval bell was DEAD: notify_listing_review() only fired its
--    "approved" branch when NEW.status = 'active', but the market lifecycle-v3
--    rename made approval set status = 'live'. So sellers stopped getting the
--    in-app "your listing is approved" notification. Accept both 'live' and
--    the legacy 'active' alias.
-- 2. Verification approval had NO notification at all — the only trigger on
--    user_verifications just flipped users.is_verified. Add a bell for both
--    approval and rejection, mirroring the listing pattern.

-- ---------------------------------------------------------------------------
-- 1. Listing review: fire on the current 'live' status (plus legacy 'active').
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_listing_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (NEW.status is distinct from OLD.status) then
    if NEW.status in ('live', 'active') then
      perform public.create_notification(
        NEW.seller_id,
        'تمت الموافقة على إعلانك',
        'Your listing was approved',
        'إعلانك "' || NEW.title || '" أصبح ظاهراً الآن في السوق.',
        'Your listing "' || NEW.title || '" is now live on the market.',
        'listing', NEW.id);
    elsif NEW.status = 'rejected' then
      perform public.create_notification(
        NEW.seller_id,
        'لم تتم الموافقة على إعلانك',
        'Your listing was rejected',
        'لم تتم الموافقة على إعلانك "' || NEW.title || '". يمكنك تعديله وإعادة إرساله.',
        'Your listing "' || NEW.title || '" was not approved. You can edit and resubmit it.',
        'listing', NEW.id);
    end if;
  end if;
  return NEW;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 2. Verification review: new bell on approve / reject.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_verification_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (NEW.status is distinct from OLD.status) then
    if NEW.status = 'approved' then
      perform public.create_notification(
        NEW.user_id,
        'تم توثيق حسابك',
        'Your account is verified',
        'تم توثيق هويتك بنجاح، وأصبحت شارة التوثيق ظاهرة على حسابك الآن.',
        'Your identity has been verified. Your verified badge is now active.',
        'verification', NEW.id);
    elsif NEW.status = 'rejected' then
      perform public.create_notification(
        NEW.user_id,
        'لم يتم قبول طلب التوثيق',
        'Verification not approved',
        coalesce('سبب الرفض: ' || NEW.rejection_reason,
                 'لم تتم الموافقة على طلب التوثيق. يمكنك إعادة المحاولة.'),
        coalesce('Reason: ' || NEW.rejection_reason,
                 'Your verification was not approved. You can try again.'),
        'verification', NEW.id);
    end if;
  end if;
  return NEW;
end;
$function$;

DROP TRIGGER IF EXISTS trg_notify_verification_review ON public.user_verifications;
CREATE TRIGGER trg_notify_verification_review
  AFTER UPDATE ON public.user_verifications
  FOR EACH ROW EXECUTE FUNCTION public.notify_verification_review();
