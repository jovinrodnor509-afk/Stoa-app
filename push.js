/* STOA — notifikasyon push (OneSignal). Chaje ak: <script src="push.js"></script> */
window.OneSignalDeferred = window.OneSignalDeferred || [];

(function(){
  // Chemen ki bon sou GitHub Pages (/Stoa-app/) kèlkeswa kote sit la ye
  var base = location.pathname.replace(/[^\/]*$/, '');          // ex: "/Stoa-app/"
  var swPath = base.replace(/^\//, '') + 'sw.js';               // ex: "Stoa-app/sw.js"

  OneSignalDeferred.push(async function(OneSignal){
    try{
      await OneSignal.init({
        appId: "332143af-0e0c-4979-b52c-7f0bda021938",
        notifyButton: { enable: false },
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: swPath,
        serviceWorkerParam: { scope: base }
      });
      var ph = localStorage.getItem('stoa_ac_phone');
      if(ph) { try{ await OneSignal.login(ph); }catch(e){} }
    }catch(e){ console.log('OneSignal init erè:', e); }
  });

  function toast(m){
    if(typeof acNotify === 'function') acNotify(m);
    else alert(m);
  }

  // Mande pèmisyon + abònman (dwe rele nan yon klik itilizatè)
  window.stoaAskPush = function(showResult){
    OneSignalDeferred.push(async function(o){
      try{
        if(!o.Notifications.permission){
          await o.Notifications.requestPermission();
        }
        if(o.Notifications.permission){
          await o.User.PushSubscription.optIn();
          var ph = localStorage.getItem('stoa_ac_phone');
          if(ph){ try{ await o.login(ph); }catch(e){} }
          if(showResult) toast('🔔 Notifikasyon aktive.');
        } else if(showResult){
          toast('Notifikasyon bloke. Ale nan paramèt Chrome → Paramèt sit → Notifikasyon → Otorize.');
        }
      }catch(e){ if(showResult) toast('Erè notifikasyon: ' + (e && e.message ? e.message : e)); }
    });
  };

  // Vèsyon dyagnostik pou admin (bouton "Aktive notifikasyon" nan Sou Mwen)
  window.stoaEnablePush = function(){
    OneSignalDeferred.push(async function(o){
      try{
        await o.Notifications.requestPermission();
        await o.User.PushSubscription.optIn();
        var ps = o.User.PushSubscription;
        alert('Otorizasyon: ' + o.Notifications.permission + '\nAbònman aktif: ' + ps.optedIn + '\nID: ' + (ps.id || 'pa gen') + '\nToken: ' + (ps.token ? 'wi' : 'non'));
      }catch(e){ alert('Erè: ' + (e && e.message ? e.message : e)); }
    });
  };

  // Mande pèmisyon otomatikman lè moun nan klike Enskri oswa Kreye Pwofil
  document.addEventListener('click', function(e){
    var t = e.target && e.target.closest ? e.target.closest('#regSubmit, #acSaveProfile') : null;
    if(t) window.stoaAskPush(false);
  }, true);

  // Bouton "Aktive notifikasyon" nan AyitiChat
  document.addEventListener('DOMContentLoaded', function(){
    var banner = document.querySelector('.ac-info-banner');
    if(!banner || document.getElementById('acPushBtn')) return;
    var b = document.createElement('button');
    b.id = 'acPushBtn';
    b.className = 'ac-share-btn';
    b.style.marginTop = '10px';
    b.textContent = '🔔 Aktive notifikasyon';
    b.addEventListener('click', function(){ window.stoaAskPush(true); });
    banner.insertAdjacentElement('afterend', b);
  });
})();
