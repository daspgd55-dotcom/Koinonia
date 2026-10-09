import unittest
from google_maps_rich import transform_rich
class RichExportTests(unittest.TestCase):
 def row(self):
  return {'title':'Iglesia de Prueba','categoryName':'Iglesia','address':'Av. Brasil 153, 8340497 Santiago, Región Metropolitana, Chile','city':'Santiago','location/lat':-33.45,'location/lng':-70.65,'url':'https://www.google.com/maps/search/?query_place_id=ChIJ123456','imageUrl':'https://example.org/image.jpg','instagramProfiles/0/profilePictureURL':'https://example.org/image.jpg','website':'https://example.org','instagramProfiles/0/externalProfileURL':'https://example.org','phones/0':'+56 9 1234 5678','phones/1':'912345678','openingHours/0/day':'miércoles','openingHours/0/hours':'7:30 to 9 PM'}
 def transform(self,row):return transform_rich(row,2,'dataset_2026-09-30_19-48-48-079.xlsx','test')
 def test_extended_fields(self):
  r,status,_=self.transform(self.row());self.assertEqual(status,'accepted');c=r['church'];self.assertEqual(len(c['media']),1);self.assertEqual(len(c['externalProfile']['links']),1);self.assertEqual(c['externalProfile']['phones'],['+56912345678']);self.assertEqual(c['location']['postalCode'],'8340497');self.assertEqual(c['externalProfile']['openingHours'][0]['intervals'][0]['startTime'],'19:30');self.assertEqual(c['externalProfile']['capturedAtBasis'],'export_filename_timezone_unknown')
 def test_pollution(self):
  row=self.row();row['title']='Sociedad Pesquera de Prueba';self.assertEqual(self.transform(row)[1],'excluded');row['title']='Juan Bautista Pérez';self.assertEqual(self.transform(row)[1],'review');row['title']='Iglesia Prueba';row['categoryName']='Parada de autobús';self.assertEqual(self.transform(row)[1],'excluded')
if __name__=='__main__': unittest.main()
