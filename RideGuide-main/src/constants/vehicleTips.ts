/**
 * "Tip of the day" for the home screen. Bundled with the app: free, works offline, no AI quota.
 * One tip per day, the same for everyone, cycling through the list.
 */

export type VehicleTip = {
  title: string;
  text: string;
  category: 'Maintenance' | 'Safety' | 'Rainy season' | 'Fuel saving' | 'Warning signs' | 'Breakdowns' | 'Hot weather';
};

export const VEHICLE_TIPS: VehicleTip[] = [
  { category: 'Maintenance', title: 'Check tyre pressure monthly', text: 'Check it when the tyres are cold, before driving. The right pressure is on a sticker inside the driver’s door or in the manual.' },
  { category: 'Rainy season', title: 'Lights on in heavy rain', text: 'Switch on your headlights in heavy rain, even in daytime, and keep at least double the usual gap to the vehicle in front.' },
  { category: 'Warning signs', title: 'A squeal on cold starts', text: 'A high squeal when you start the engine in the morning usually means a worn or loose drive belt. Have it checked before it snaps.' },
  { category: 'Maintenance', title: 'Check the engine oil', text: 'Once a month, on level ground with the engine off and cool, pull the dipstick. The oil should sit between the two marks.' },
  { category: 'Hot weather', title: 'Watch the temperature gauge', text: 'If the needle climbs towards hot in traffic, turn off the A/C, turn the heater to full, and pull over safely if it keeps rising.' },
  { category: 'Safety', title: 'Never open a hot radiator', text: 'The coolant is under pressure and can spray and burn you. Wait at least 30 minutes for the engine to cool first.' },
  { category: 'Rainy season', title: 'Don’t drive into flood water', text: 'Just 30 cm of moving water can float a car, and water sucked into the engine can wreck it. If you can’t see the road, turn back.' },
  { category: 'Fuel saving', title: 'Smooth driving saves fuel', text: 'Gentle acceleration and braking early can cut fuel use by up to 20%. Look far ahead so you can coast instead of braking hard.' },
  { category: 'Maintenance', title: 'Replace worn wiper blades', text: 'If your wipers smear, streak or judder, replace them before the monsoon. Good wipers are one of the cheapest safety upgrades.' },
  { category: 'Warning signs', title: 'Grinding when you brake', text: 'A metal-on-metal grinding sound usually means the brake pads are worn through. Stop driving and get the brakes checked soon.' },
  { category: 'Breakdowns', title: 'If your car breaks down', text: 'Pull as far off the road as you can, switch on the hazard lights, and wait somewhere safe away from traffic, not inside the car on a busy road.' },
  { category: 'Maintenance', title: 'Check tyre tread depth', text: 'Tread should be at least 1.6 mm deep. Below about 3 mm your stopping distance on wet roads gets much longer.' },
  { category: 'Fuel saving', title: 'Lighten the load', text: 'Take heavy things you don’t need out of the boot and remove empty roof racks. Extra weight and drag both burn more fuel.' },
  { category: 'Warning signs', title: 'Check engine light', text: 'A steady light means get it checked soon. A flashing light means a serious misfire: slow down and get help, as it can damage the catalytic converter.' },
  { category: 'Hot weather', title: 'Park in the shade', text: 'In strong sun the cabin can pass 60°C. Shade or a windscreen sun shade protects the dashboard and keeps the battery cooler.' },
  { category: 'Maintenance', title: 'Keep the battery terminals clean', text: 'White or green crust on the battery terminals causes starting problems. Clean it off with a brush and a little baking soda and water.' },
  { category: 'Safety', title: 'Seat belts in the back too', text: 'Rear passengers without belts can be thrown forward in a crash and injure the people in front. Everyone buckles up, every trip.' },
  { category: 'Rainy season', title: 'If you start aquaplaning', text: 'If the steering suddenly feels light on a wet road, ease off the accelerator and hold the wheel straight. Don’t brake hard or jerk the wheel.' },
  { category: 'Maintenance', title: 'Top up washer fluid', text: 'Use proper washer fluid or water with a little washer additive. Plain detergent can damage paint and rubber seals.' },
  { category: 'Warning signs', title: 'Sweet smell from the engine', text: 'A sweet, syrupy smell often means a coolant leak. Look for green, pink or orange drips under the car and get it checked.' },
  { category: 'Fuel saving', title: 'Use A/C wisely', text: 'At low speeds open windows use less fuel; above about 60 km/h, A/C with the windows closed is more efficient because of drag.' },
  { category: 'Breakdowns', title: 'Keep a basic kit in the car', text: 'A torch, warning triangle, jumper cables, a bottle of water and a phone charger will get you through most roadside problems.' },
  { category: 'Safety', title: 'Use engine braking downhill', text: 'On long hill-country descents, shift to a lower gear so the engine helps slow the car. Riding the brakes can make them overheat and fade.' },
  { category: 'Maintenance', title: 'Rotate your tyres', text: 'Swapping tyres front to back about every 10,000 km helps them wear evenly and last longer.' },
  { category: 'Warning signs', title: 'Car pulls to one side', text: 'If the car drifts left or right on a straight road, the wheel alignment or a tyre pressure may be off. Both wear tyres fast.' },
  { category: 'Rainy season', title: 'Dry your brakes after water', text: 'After driving through deep water, press the brakes gently a few times at low speed to dry them before you need them.' },
  { category: 'Hot weather', title: 'Check coolant before long trips', text: 'With the engine cold, check that the coolant is between MIN and MAX in the overflow tank. Low coolant is a common cause of overheating.' },
  { category: 'Maintenance', title: 'Follow the service schedule', text: 'Regular servicing at the intervals in your manual is cheaper than fixing what breaks when it’s skipped.' },
  { category: 'Safety', title: 'Keep a safe following distance', text: 'Leave at least a 3-second gap to the vehicle ahead in dry weather, and more in rain, at night, or behind buses and lorries.' },
  { category: 'Fuel saving', title: 'Don’t idle for long', text: 'If you’re waiting more than a minute or two with the car parked, switch the engine off. Idling burns fuel and goes nowhere.' },
  { category: 'Warning signs', title: 'Blue or white exhaust smoke', text: 'Blue smoke usually means the engine is burning oil; thick white smoke that doesn’t clear can mean coolant is getting into the engine.' },
  { category: 'Breakdowns', title: 'Jump-starting safely', text: 'Connect red to both positive terminals, black to the good battery’s negative, then the other black to bare metal on the dead car, away from the battery.' },
  { category: 'Maintenance', title: 'Check the air filter', text: 'A dusty, clogged air filter makes the engine work harder. On dusty roads, check it at every service and replace it when it looks dark.' },
  { category: 'Rainy season', title: 'Clear your windscreen fog', text: 'Turn on the A/C with the fan aimed at the windscreen. A/C dries the air and clears fog faster than opening a window.' },
  { category: 'Safety', title: 'Put the phone away', text: 'Even a few seconds looking at a phone at 60 km/h means driving blind for the length of a football field. Let calls wait.' },
  { category: 'Hot weather', title: 'Battery life in the heat', text: 'Heat wears batteries out faster than cold. If your battery is over 3 years old, have it tested before it leaves you stranded.' },
  { category: 'Warning signs', title: 'Vibration in the steering wheel', text: 'Shaking at certain speeds often means the wheels need balancing. Shaking only when braking usually points to warped brake discs.' },
  { category: 'Maintenance', title: 'Don’t ignore small leaks', text: 'A small puddle under the car is easier and cheaper to fix early. Note its colour: black is oil, red can be transmission or power steering fluid.' },
  { category: 'Fuel saving', title: 'Keep tyres properly inflated', text: 'Under-inflated tyres increase rolling resistance and fuel use, and wear out faster on the edges.' },
  { category: 'Breakdowns', title: 'Changing a flat tyre', text: 'Loosen the wheel nuts slightly before jacking the car up, use the jack point in the manual, and never put any part of your body under the car.' },
  { category: 'Safety', title: 'Watch for three-wheelers and bikes', text: 'Motorcycles and three-wheelers can appear in your blind spot quickly. Check your mirrors and look over your shoulder before changing lanes.' },
  { category: 'Rainy season', title: 'Slow down on the first rain', text: 'The first rain after a dry spell lifts oil and dust off the road and makes it especially slippery. Take corners gently.' },
  { category: 'Maintenance', title: 'Check your lights', text: 'Once a week, check headlights, brake lights and indicators. Ask someone to stand behind the car while you press the brake.' },
  { category: 'Warning signs', title: 'Spongy brake pedal', text: 'If the brake pedal feels soft or sinks further than usual, there may be air or a leak in the brake system. Get it checked right away.' },
  { category: 'Hot weather', title: 'Don’t leave children or pets in the car', text: 'Even with the windows slightly open, a parked car can become dangerously hot within minutes in the sun.' },
  { category: 'Fuel saving', title: 'Plan your trips', text: 'Combine errands into one trip. A cold engine uses much more fuel for the first few kilometres than a warm one.' },
  { category: 'Maintenance', title: 'Use the right fuel', text: 'Use the octane rating your manual recommends. Higher octane than needed costs more without making a normal engine faster.' },
  { category: 'Breakdowns', title: 'Battery is flat?', text: 'Clicking but no start usually means a flat battery. Lights that are dim and a slow crank also point to the battery or its terminals.' },
  { category: 'Safety', title: 'Adjust your mirrors', text: 'Set the side mirrors so you can just see the edge of your car. That covers more of the lanes beside you and shrinks blind spots.' },
  { category: 'Warning signs', title: 'Clunk over bumps', text: 'A knock or clunk when going over bumps often means worn suspension parts such as links, bushes or shock absorbers.' },
  { category: 'Rainy season', title: 'Check your tyres before the monsoon', text: 'Worn tyres can’t push water away. Before the rainy season, check the tread and replace tyres that are close to the limit.' },
  { category: 'Maintenance', title: 'Warm up gently', text: 'Modern engines don’t need long warm-ups. Drive off after about 30 seconds and go easy for the first few kilometres.' },
  { category: 'Hot weather', title: 'Long drives in the heat', text: 'On long trips, stop every two hours. It rests you and lets you check for leaks, tyre damage or a rising temperature gauge.' },
  { category: 'Fuel saving', title: 'Keep to steady speeds', text: 'Most cars are most efficient around 60–80 km/h. Going faster uses noticeably more fuel because of wind resistance.' },
  { category: 'Safety', title: 'Rest when you’re tired', text: 'Drowsy driving is as dangerous as drunk driving. If you’re yawning or drifting, stop somewhere safe and take a 15-minute break.' },
  { category: 'Warning signs', title: 'Burning smell', text: 'A burning rubber smell can be a slipping belt or a stuck brake; a burning oil smell can be an oil leak on the hot exhaust. Have it checked.' },
  { category: 'Breakdowns', title: 'Save useful numbers', text: 'Keep your breakdown service, insurance and a trusted mechanic’s numbers in your phone, so you’re not searching when you’re stuck.' },
  { category: 'Maintenance', title: 'Wash off mud and salt', text: 'After driving on muddy or coastal roads, rinse the underside and wheel arches. Dirt and salt speed up rust.' },
  { category: 'Rainy season', title: 'Watch for landslide warnings', text: 'In hill-country during heavy rain, check for road closures before you leave and avoid driving at night near slopes.' },
  { category: 'Safety', title: 'Keep both hands ready', text: 'Hold the wheel at about “nine and three”. It gives you the most control if you need to swerve suddenly.' },
];

/** The same tip for everyone on a given (local) day, moving to the next tip each day. */
export function tipOfTheDay(date: Date = new Date()): VehicleTip {
  const localDay = Math.floor(
    (Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(2026, 0, 1)) / 86_400_000
  );
  const index = ((localDay % VEHICLE_TIPS.length) + VEHICLE_TIPS.length) % VEHICLE_TIPS.length;
  return VEHICLE_TIPS[index];
}
