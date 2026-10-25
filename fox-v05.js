
"use strict";
// Fox Optimiser v0.5 measured-data display

(function(){

  const panel=document.createElement("section");
  panel.className="panel";
  panel.id="v05Logger";

  panel.innerHTML=`
    <h3>28-day measured learning</h3>
    <p id="v05Days"
       style="font-size:1.5rem;font-weight:700">
       0 / 28 valid days
    </p>
    <p id="v05Status" class="note">
       Awaiting battery measurements
    </p>
    <p class="note">
       A day qualifies when at least 95% of its
       one-minute measurements are recorded.
       The learning period cannot start until
       real measurement collection is connected.
    </p>
  `;

  const calendar=document.getElementById(
    "v4Calendar"
  );

  if(calendar){
    calendar.insertAdjacentElement(
      "beforebegin",panel
    );
  }else{
    document.querySelector("main").append(panel);
  }

  async function refresh(){
    try{
      const response=await fetch(
        "/api/status",{cache:"no-store"}
      );

      if(!response.ok){
        throw new Error("Logger unavailable");
      }

      const data=await response.json();

      document.getElementById(
        "v05Days"
      ).textContent=
        data.valid_days+
        " / "+data.required_days+" valid days";

      document.getElementById(
        "v05Status"
      ).textContent=
        data.readings
        ? (data.fresh
            ? "Recent measurements received. "
            : "Measurements are currently stale. ")+
          "Total minute records: "+data.readings+
          ". Last recorded: "+
          new Date(data.last_reading*1000)
            .toLocaleString("en-GB")+
          ". Readings are connector-reported."
        : "Awaiting real measurements. "+
          "The 28-day countdown has not started.";

      if(data.valid_days>0){
        const note=document.querySelector(
          "#v4Learning .note"
        );
        if(note){
          note.textContent=
            data.valid_days+
            " of 28 valid learning days recorded. "+
            "The overnight recommendation remains "+
            "100% during learning.";
        }
      }

    }catch(error){
      document.getElementById(
        "v05Status"
      ).textContent=
        "Local logger not running yet. "+
        "No learning days counted.";
    }
  }

  refresh();

  setInterval(()=>{
    if(document.visibilityState==="visible"){
      refresh();
    }
  },60000);

  document.addEventListener(
    "visibilitychange",()=>{
      if(document.visibilityState==="visible"){
        refresh();
      }
    }
  );

})();
